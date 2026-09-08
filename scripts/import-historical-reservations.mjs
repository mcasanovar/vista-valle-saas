// One-time importer for Vista Valle's pre-system reservation history (task 1
// of openspec/changes/import-historical-reservations). Reads the
// "homologado" sheet of scripts/vista-valle-historial.xlsx, homologates its
// fields to the current schema, and replaces all test data in the database
// with the imported history.
//
// This is a single-use operational script, not application code:
//   - It never runs from the Next.js app; it is invoked manually from a
//     terminal against a real DATABASE_URL.
//   - Its .xlsx reader only understands what this specific workbook uses
//     (shared strings, numeric/inline cells, one merged-title row per
//     block). It is not a general-purpose spreadsheet parser and must not
//     be reused as one.
//   - Every reservation gets a deterministic "VV-<uuid>" public id derived
//     from its source row, so a second run never duplicates data. The id
//     looks like a random reservation id (see
//     src/features/reservations/create-pay-at-property-reservation.ts) but
//     is not one - this is intentional, see design.md decision 6.
//
// Usage:
//   node scripts/import-historical-reservations.mjs [manifest.xlsx]        # dry run, no writes
//   node scripts/import-historical-reservations.mjs [manifest.xlsx] --commit
//
// Requires DATABASE_URL in the environment (.env.local is not loaded
// automatically - export it first, e.g. `set -a; source .env.local; set +a`).
// Refuses to run against a missing or mock DATABASE_URL.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import crypto from "node:crypto";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = path.resolve(__dirname, "vista-valle-historial.xlsx");
const SHEET_NAME = "homologado";

function printUsage() {
  console.log(`Uso:
  node scripts/import-historical-reservations.mjs [manifest.xlsx]            Simulación (no escribe nada)
  node scripts/import-historical-reservations.mjs [manifest.xlsx] --commit   Ejecuta la limpieza e importación reales

manifest.xlsx por omisión: ${path.relative(process.cwd(), DEFAULT_MANIFEST)}
Requiere DATABASE_URL en el entorno para cualquier modo (incluida la simulación,
que solo lee el catálogo de habitaciones).`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }
  const commit = args.includes("--commit");
  const positional = args.filter((a) => a !== "--commit");
  const manifestPath = positional[0]
    ? path.resolve(process.cwd(), positional[0])
    : DEFAULT_MANIFEST;
  return { help: false, commit, manifestPath };
}

// ---------------------------------------------------------------------------
// Minimal ZIP + OOXML reader (task 1.2). An .xlsx file is a ZIP archive of
// XML parts. We only need: locate a part by name (via the central
// directory), and inflate it if it was DEFLATE-compressed.
// ---------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer) {
  // The EOCD record is at least 22 bytes and can be followed by a comment
  // of up to 65535 bytes, so search backwards from the end.
  const minOffset = Math.max(0, buffer.length - 22 - 65535);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error(
    "No se encontró el registro de fin de directorio central del ZIP: el archivo no parece un .xlsx válido"
  );
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);

  const entries = new Map();
  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error(
        `Directorio central del ZIP corrupto en el offset ${offset}`
      );
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    entries.set(fileName, {
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function extractZipEntry(buffer, entries, name) {
  const entry = entries.get(name);
  if (!entry) {
    throw new Error(
      `El archivo .xlsx no contiene la parte esperada "${name}"`
    );
  }
  const { localHeaderOffset, compressionMethod, compressedSize } = entry;
  if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Encabezado local del ZIP corrupto para "${name}"`);
  }
  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const raw = buffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) return raw.toString("utf8");
  if (compressionMethod === 8) return zlib.inflateRawSync(raw).toString("utf8");
  throw new Error(
    `Método de compresión ZIP no soportado (${compressionMethod}) para "${name}"`
  );
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const shared = [];
  for (const siMatch of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = "";
    for (const tMatch of siMatch[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
      text += tMatch[1];
    }
    shared.push(decodeXmlEntities(text));
  }
  return shared;
}

/** Map<rowNumber, Record<columnLetter, string>>, reading only cells that carry a value. */
function parseSheetRows(xml, sharedStrings) {
  const rows = new Map();
  for (const rowMatch of xml.matchAll(/<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = {};
    for (const cellMatch of rowMatch[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!ref) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      let value;
      if (type === "inlineStr") {
        value = decodeXmlEntities(
          /<t[^>]*>([\s\S]*?)<\/t>/.exec(cellMatch[2])?.[1] ?? ""
        );
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1];
        if (raw === undefined) continue;
        value = type === "s" ? sharedStrings[Number(raw)] : decodeXmlEntities(raw);
      }
      if (value !== "" && value !== undefined) cells[ref] = value;
    }
    if (Object.keys(cells).length > 0) rows.set(rowNumber, cells);
  }
  return rows;
}

function findSheetTarget(workbookXml, relsXml, sheetName) {
  const sheetTags = [...workbookXml.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => m[0]);
  const availableNames = [];
  for (const tag of sheetTags) {
    const name = decodeXmlEntities(/\bname="([^"]*)"/.exec(tag)?.[1] ?? "");
    availableNames.push(name);
    if (name !== sheetName) continue;
    const rId = /\br:id="([^"]*)"/.exec(tag)?.[1];
    if (!rId) throw new Error(`La hoja "${sheetName}" no declara r:id`);
    const relTag = [...relsXml.matchAll(/<Relationship\b[^>]*\/>/g)]
      .map((m) => m[0])
      .find((tag2) => tag2.includes(`Id="${rId}"`));
    const target = relTag && /\bTarget="([^"]*)"/.exec(relTag)?.[1];
    if (!target) throw new Error(`No se encontró la relación "${rId}" para la hoja "${sheetName}"`);
    return target;
  }
  throw new Error(
    `El libro no contiene una pestaña llamada "${sheetName}". Pestañas disponibles: ${availableNames.join(", ")}`
  );
}

function readXlsxSheet(manifestPath, sheetName) {
  const buffer = readFileSync(manifestPath);
  const entries = readZipEntries(buffer);
  const workbookXml = extractZipEntry(buffer, entries, "xl/workbook.xml");
  const relsXml = extractZipEntry(buffer, entries, "xl/_rels/workbook.xml.rels");
  const sharedStringsXml = entries.has("xl/sharedStrings.xml")
    ? extractZipEntry(buffer, entries, "xl/sharedStrings.xml")
    : "";
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  const target = findSheetTarget(workbookXml, relsXml, sheetName);
  const sheetPath = target.startsWith("/")
    ? target.slice(1)
    : `xl/${target}`;
  const sheetXml = extractZipEntry(buffer, entries, sheetPath);
  return parseSheetRows(sheetXml, sharedStrings);
}

// ---------------------------------------------------------------------------
// Excel serial date <-> calendar date (task 1.4)
// ---------------------------------------------------------------------------

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

function serialToIsoDate(serial) {
  const days = Math.round(Number(serial));
  const ms = EXCEL_EPOCH_UTC_MS + days * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

function serialToYmd(serial) {
  const iso = serialToIsoDate(serial);
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function isoDateToSerial(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const ms = Date.UTC(year, month - 1, day) - EXCEL_EPOCH_UTC_MS;
  return Math.round(ms / MS_PER_DAY);
}

function addDaysToIsoDate(iso, days) {
  return serialToIsoDate(isoDateToSerial(iso) + days);
}

function daysBetweenIsoDates(fromIso, toIso) {
  return isoDateToSerial(toIso) - isoDateToSerial(fromIso);
}

// ---------------------------------------------------------------------------
// The three blocks of the "homologado" sheet (task 1.3). 2024 and 2025 sit
// side by side in the same row band, not stacked - see design.md - Context.
// ---------------------------------------------------------------------------

const EXPECTED_HEADERS = [
  "Nombre Arrendatario",
  "Fecha entrada",
  "Fecha Salida",
  "Cant noches",
  "Pieza",
  "Valor por noche",
  "Plataforma",
  "Total Neto",
  "Estado pago",
];

// Column order within each block matches EXPECTED_HEADERS: name, checkIn,
// checkOut, nights, room, nightlyPrice, platform, netTotal, paymentStatus.
const BLOCKS = [
  { year: 2024, cols: ["C", "D", "E", "F", "G", "H", "I", "N", "O"], headerRow: 7, from: 8, to: 225 },
  { year: 2025, cols: ["Q", "R", "S", "T", "U", "V", "W", "AB", "AC"], headerRow: 7, from: 8, to: 281 },
  { year: 2026, cols: ["C", "D", "E", "F", "G", "H", "I", "N", "O"], headerRow: 227, from: 228, to: 435 },
];

function validateBlockHeader(block, rows) {
  const headerCells = rows.get(block.headerRow) ?? {};
  block.cols.forEach((col, index) => {
    const actual = (headerCells[col] ?? "").toString().trim();
    const expected = EXPECTED_HEADERS[index];
    if (actual !== expected) {
      throw new Error(
        `Encabezado inesperado en el bloque ${block.year}: la columna ${col} de la fila ${block.headerRow} dice "${actual}", se esperaba "${expected}". La planilla pudo haber cambiado de estructura.`
      );
    }
  });
}

/**
 * Reads one block into raw row records. A row is skipped only when every
 * field the pipeline reads from it is empty (a spacer row inside the
 * block's range) - see spec "Lectura completa de la planilla histórica".
 */
function readBlockRows(block, rows) {
  validateBlockHeader(block, rows);
  const [nameCol, checkInCol, checkOutCol, nightsCol, roomCol, priceCol, platformCol, netCol, statusCol] =
    block.cols;
  const records = [];
  for (let rowNumber = block.from; rowNumber <= block.to; rowNumber += 1) {
    const cells = rows.get(rowNumber);
    if (!cells) continue;
    const nombre = cells[nameCol];
    const inRaw = cells[checkInCol];
    const outRaw = cells[checkOutCol];
    const netoRaw = cells[netCol];
    if (!nombre && !inRaw && !outRaw && !netoRaw) continue;
    records.push({
      year: block.year,
      row: rowNumber,
      nombre,
      inRaw,
      outRaw,
      nochesRaw: cells[nightsCol],
      piezaRaw: cells[roomCol],
      valorRaw: cells[priceCol],
      platRaw: cells[platformCol],
      netoRaw,
      estadoRaw: cells[statusCol],
    });
  }
  return records;
}

function readHistoricalRows(manifestPath) {
  const rows = readXlsxSheet(manifestPath, SHEET_NAME);
  const byYear = new Map(BLOCKS.map((block) => [block.year, readBlockRows(block, rows)]));
  const all = BLOCKS.flatMap((block) => byYear.get(block.year));
  return { all, byYear, counts: Object.fromEntries(BLOCKS.map((b) => [b.year, byYear.get(b.year).length])) };
}

// ---------------------------------------------------------------------------
// Field homologation (task group 2)
// ---------------------------------------------------------------------------

/** Pieza -> room slug (spec "Homologación de piezas a habitaciones del catálogo"). */
const ROOM_SLUG_BY_PIEZA = {
  chica: "habitacion-individual-valle",
  grande: "habitacion-matrimonial-valle",
  "extra grande": "habitacion-doble-valle",
};

function resolveRoomSlug(piezaRaw) {
  const key = (piezaRaw ?? "").toString().trim().toLowerCase();
  return ROOM_SLUG_BY_PIEZA[key];
}

/** Plataforma -> reservation origin (spec "Homologación de plataforma a origen de reserva"). */
function resolveOrigin(platRaw) {
  const key = (platRaw ?? "").toString().trim().toLowerCase();
  if (key === "booking") return "booking";
  if (key === "arbnb") return "airbnb";
  if (key === "otro" || key === "") return "whatsapp";
  return undefined;
}

/**
 * Estado de pago -> reservation status + payment (spec "Homologación del
 * estado de pago a estado de reserva y pago"). `today` is injectable for
 * deterministic testing.
 */
function resolveStatus(estadoRaw, checkOutIso, today = new Date().toISOString().slice(0, 10)) {
  const key = (estadoRaw ?? "").toString().trim();
  if (key === "Cancelado") {
    return { reservationStatus: "cancelled", payment: undefined };
  }
  if (key !== "Pagado" && key !== "Pendiente") {
    return undefined;
  }
  const reservationStatus = checkOutIso <= today ? "completed" : "confirmed";
  const paymentStatus = key === "Pagado" ? "approved" : "pending";
  return { reservationStatus, payment: { status: paymentStatus } };
}

const IMPORT_EMAIL_DOMAIN = "importado.vistavalle.local";
const IMPORT_PLACEHOLDER_PHONE = "N/D";

function slugifyNamePart(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Splits the planilla's single name field into guest first/last name (spec "Huésped por reserva con datos mínimos sintetizados"). */
function resolveGuest(nombreRaw, year, row) {
  const trimmed = (nombreRaw ?? "").toString().trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  const parts = trimmed.split(" ");
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "(sin apellido - import histórico)";
  const emailLocal = slugifyNamePart(trimmed) || "cliente";
  return {
    firstName,
    lastName,
    email: `historico-${year}-${row}-${emailLocal}@${IMPORT_EMAIL_DOMAIN}`,
    phone: IMPORT_PLACEHOLDER_PHONE,
  };
}

// ---------------------------------------------------------------------------
// Saneamiento (task group 3)
// ---------------------------------------------------------------------------

/**
 * The 5 rows whose defect no general rule explains (design.md decision 4).
 * Each `expect` fingerprint is the exact raw cell text this script found
 * for that row during the analysis that produced this list; if the
 * planilla no longer matches, the whole run aborts rather than risk
 * applying someone else's correction to the wrong row (spec "Corrección
 * declarada que no calza").
 */
const EXPLICIT_CORRECTIONS = [
  {
    year: 2024,
    row: 18,
    expect: { nombre: "Pia Ramirez", inRaw: "1.0", outRaw: undefined, nochesRaw: undefined, piezaRaw: "Grande", valorRaw: "35000.0", platRaw: "otro", netoRaw: "35000", estadoRaw: "Pagado" },
    apply: (draft) => {
      draft.checkIn = "2024-01-04";
      draft.checkOut = "2024-01-05";
    },
  },
  {
    year: 2025,
    row: 167,
    expect: { nombre: "Octavio Leyton", inRaw: "45901.0", outRaw: "45779.0", nochesRaw: "1.0", piezaRaw: "Chica", valorRaw: "42000.0", platRaw: "otro", netoRaw: "42000", estadoRaw: "Pagado" },
    apply: (draft) => {
      draft.checkIn = "2025-05-01";
      draft.checkOut = "2025-05-02";
    },
  },
  {
    year: 2026,
    row: 435,
    expect: { nombre: "Franco Beltrán ", inRaw: "46241.0", outRaw: "46273.0", nochesRaw: "1.0", piezaRaw: "Chica", valorRaw: "39000.0", platRaw: "otro", netoRaw: "39000", estadoRaw: "Pagado" },
    apply: (draft) => {
      draft.checkIn = "2026-09-07";
      draft.checkOut = "2026-09-08";
    },
  },
  {
    year: 2024,
    row: 142,
    expect: { nombre: "Cobs Valencia", inRaw: "45534.0", outRaw: "45535.0", nochesRaw: "1.0", piezaRaw: "Grande", valorRaw: "0.0", platRaw: "booking", netoRaw: "-31570", estadoRaw: "Pagado" },
    apply: (draft) => {
      draft.valorNoche = 38802;
      draft.neto = 38802;
    },
  },
  {
    year: 2024,
    row: 165,
    expect: { nombre: "Jose Fuster", inRaw: "45553.0", outRaw: "45554.0", nochesRaw: "0.0", piezaRaw: "Grande", valorRaw: "47", platRaw: undefined, netoRaw: "0", estadoRaw: "Cancelado" },
    apply: (draft) => {
      draft.valorNoche = 38802;
      draft.neto = 38802;
    },
  },
  // Two rows whose "Total Neto" is $0 without being cancelled - the
  // schema's payments_amount_positive check rejects a $0 payment, and
  // "Pagado"/"Pendiente" rows always carry a payment (spec "Homologación
  // del estado de pago a estado de reserva y pago"). Confirmed with the
  // dueño del producto after the first --commit attempt aborted on this
  // constraint.
  {
    year: 2024,
    row: 160,
    expect: { nombre: "Claudia Concha", inRaw: "45549.0", outRaw: "45550.0", nochesRaw: "1.0", piezaRaw: "Chica", valorRaw: "37318.0", platRaw: "arbnb", netoRaw: "0", estadoRaw: "Pagado" },
    apply: (draft) => {
      draft.neto = 37618;
    },
  },
  {
    year: 2024,
    row: 215,
    expect: { nombre: "Alvaro Mestre", inRaw: "45635.0", outRaw: "45636.0", nochesRaw: "1.0", piezaRaw: "Chica", valorRaw: "0.0", platRaw: "booking", netoRaw: "0", estadoRaw: "Pendiente" },
    apply: (draft) => {
      draft.explicitlyRejected = "excluida por decisión del dueño del producto: valor por noche y total neto en $0 en el Excel";
    },
  },
];

function findExplicitCorrection(year, row) {
  return EXPLICIT_CORRECTIONS.find((c) => c.year === year && c.row === row);
}

function fingerprintMatches(raw, expect) {
  return Object.keys(expect).every((key) => (raw[key] ?? undefined) === expect[key]);
}

/** A serial's year is treated as corrupted when it falls outside the block's own year ± 1 (spec "Saneamiento de fechas con año corrupto"). */
function isYearWithinBlockWindow(year, blockYear) {
  return year >= blockYear - 1 && year <= blockYear + 1;
}

/** Rebuilds a serial's day/month with the block's year, keeping day and month as decoded. */
function repairYear(serial, blockYear) {
  const { month, day } = serialToYmd(serial);
  return `${blockYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MEDIAN_FILL_MIN_VALUE = 1;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Runs one raw row through the full saneamiento pipeline and returns either
 * an accepted candidate or a rejection reason. Explicit corrections run
 * first; year repair and nights-priority only touch dates the explicit
 * correction did not already set.
 */
function sanitizeRow(raw, today) {
  const draft = {
    year: raw.year,
    row: raw.row,
    corrections: [],
  };

  const explicit = findExplicitCorrection(raw.year, raw.row);
  if (explicit) {
    if (!fingerprintMatches(raw, explicit.expect)) {
      throw new Error(
        `La corrección explícita para el bloque ${raw.year}, fila ${raw.row}, ya no coincide con el contenido de la planilla. Contenido esperado: ${JSON.stringify(explicit.expect)}. Contenido actual: ${JSON.stringify(raw)}.`
      );
    }
    explicit.apply(draft);
    if (draft.explicitlyRejected) {
      return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: draft.explicitlyRejected } };
    }
    draft.corrections.push("corrección explícita");
  }

  const roomSlug = resolveRoomSlug(raw.piezaRaw);
  if (!roomSlug) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `pieza desconocida: "${raw.piezaRaw}"` } };
  }
  draft.roomSlug = roomSlug;

  const origin = resolveOrigin(raw.platRaw);
  if (origin === undefined) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `plataforma desconocida: "${raw.platRaw}"` } };
  }
  draft.origin = origin;

  const guest = resolveGuest(raw.nombre, raw.year, raw.row);
  if (!guest) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: "sin nombre de cliente" } };
  }
  draft.guest = guest;

  const estado = (raw.estadoRaw ?? "").toString().trim();
  if (estado !== "Cancelado" && estado !== "Pagado" && estado !== "Pendiente") {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `estado de pago desconocido: "${raw.estadoRaw}"` } };
  }
  draft.estado = estado;

  // --- dates ---
  const nochesExcel = raw.nochesRaw !== undefined ? Number(raw.nochesRaw) : undefined;

  if (!draft.checkIn) {
    if (raw.inRaw === undefined) {
      return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: "sin fecha de entrada" } };
    }
    const { year: inYear } = serialToYmd(raw.inRaw);
    draft.checkIn = isYearWithinBlockWindow(inYear, raw.year)
      ? serialToIsoDate(raw.inRaw)
      : repairYear(raw.inRaw, raw.year);
    if (!isYearWithinBlockWindow(inYear, raw.year)) draft.corrections.push("año de entrada reparado");
  }
  if (!draft.checkOut) {
    if (raw.outRaw === undefined) {
      return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: "sin fecha de salida" } };
    }
    const { year: outYear } = serialToYmd(raw.outRaw);
    draft.checkOut = isYearWithinBlockWindow(outYear, raw.year)
      ? serialToIsoDate(raw.outRaw)
      : repairYear(raw.outRaw, raw.year);
    if (!isYearWithinBlockWindow(outYear, raw.year)) draft.corrections.push("año de salida reparado");
  }

  // Validate a year repair against the declared nights before trusting it.
  if (draft.corrections.some((c) => c.startsWith("año de"))) {
    if (!nochesExcel || nochesExcel <= 0) {
      return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: "año corrupto sin cantidad de noches para validar la corrección" } };
    }
    const repaired = daysBetweenIsoDates(draft.checkIn, draft.checkOut);
    if (repaired !== nochesExcel) {
      return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `la reparación de año no cuadra con las noches declaradas (${repaired} vs ${nochesExcel})` } };
    }
  }

  // Nights take priority over the fecha de salida when they disagree (spec "Prioridad de la cantidad de noches sobre las fechas").
  if (nochesExcel && nochesExcel > 0) {
    const interval = daysBetweenIsoDates(draft.checkIn, draft.checkOut);
    if (interval !== nochesExcel) {
      draft.checkOut = addDaysToIsoDate(draft.checkIn, nochesExcel);
      draft.corrections.push(`salida recalculada desde noches (${interval} → ${nochesExcel})`);
    }
  }

  const nights = daysBetweenIsoDates(draft.checkIn, draft.checkOut);
  if (nights <= 0) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `intervalo inválido tras el saneamiento: ${draft.checkIn} → ${draft.checkOut}` } };
  }
  draft.nights = nights;

  // --- amounts ---
  if (draft.neto === undefined) {
    draft.neto = raw.netoRaw !== undefined ? Number(raw.netoRaw) : NaN;
  }
  if (!Number.isFinite(draft.neto) || draft.neto < 0) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `total neto inválido: ${raw.netoRaw}` } };
  }

  if (draft.valorNoche === undefined) {
    const parsed = raw.valorRaw !== undefined ? Number(raw.valorRaw) : NaN;
    draft.valorNoche = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; // filled by median pass if still undefined
  }

  // --- status/payment ---
  const statusResult = resolveStatus(draft.estado, draft.checkOut, today);
  if (!statusResult) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `estado de pago no derivable: "${draft.estado}"` } };
  }
  draft.reservationStatus = statusResult.reservationStatus;
  draft.payment = statusResult.payment;

  // A non-cancelled row always carries a payment, and payments_amount_positive
  // requires amount_clp > 0 - a $0 "Total Neto" here needs a deliberate
  // decision (see the two explicit corrections above), not a silent insert.
  if (draft.payment && !(draft.neto > 0)) {
    return { rejected: { year: raw.year, row: raw.row, nombre: raw.nombre, reason: `total neto en $0 para una reserva ${draft.reservationStatus} sin corrección explícita` } };
  }

  return { accepted: draft };
}

/** Fills every candidate whose valorNoche is still missing with the median of its (year, roomSlug) group (spec "Reemplazo del valor por noche ausente"). */
function fillMedianNightlyPrices(candidates) {
  const groups = new Map();
  for (const c of candidates) {
    if (c.valorNoche === undefined) continue;
    const key = `${c.year}|${c.roomSlug}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c.valorNoche);
  }
  const rejected = [];
  const accepted = [];
  for (const c of candidates) {
    if (c.valorNoche !== undefined) {
      accepted.push(c);
      continue;
    }
    const key = `${c.year}|${c.roomSlug}`;
    const pool = groups.get(key);
    if (!pool || pool.length === 0) {
      rejected.push({ year: c.year, row: c.row, nombre: `${c.guest.firstName} ${c.guest.lastName}`.trim(), reason: `sin muestra para calcular la mediana de ${c.roomSlug} en ${c.year}` });
      continue;
    }
    const value = median(pool);
    accepted.push({ ...c, valorNoche: Math.max(value, MEDIAN_FILL_MIN_VALUE), corrections: [...c.corrections, `valor por noche relleno con mediana (${value})`] });
  }
  return { accepted, rejected };
}

/**
 * Runs the full saneamiento pipeline over every raw row. Returns accepted
 * candidates, rejected rows, and corrected rows (a view of accepted rows
 * that carry at least one correction) - spec "Ejecución simulada por
 * omisión".
 */
function sanitizeAllRows(rawRows, today = new Date().toISOString().slice(0, 10)) {
  const rejected = [];
  const provisional = [];
  for (const raw of rawRows) {
    const result = sanitizeRow(raw, today);
    if (result.rejected) rejected.push(result.rejected);
    else provisional.push(result.accepted);
  }
  const { accepted, rejected: medianRejected } = fillMedianNightlyPrices(provisional);
  const corrected = accepted.filter((c) => c.corrections.length > 0);
  return { accepted, rejected: [...rejected, ...medianRejected], corrected };
}

// ---------------------------------------------------------------------------
// Overlap detection (task 4.3) - reported, never rejected: these are real
// stays that happened (spec "Ejecución simulada por omisión", design.md
// Risks/Trade-offs).
// ---------------------------------------------------------------------------

function findOverlappingNights(accepted) {
  const byRoom = new Map();
  for (const c of accepted) {
    if (c.reservationStatus === "cancelled") continue; // cancelled stays never occupied the room
    if (!byRoom.has(c.roomSlug)) byRoom.set(c.roomSlug, []);
    byRoom.get(c.roomSlug).push(c);
  }
  const overlaps = [];
  for (const [roomSlug, stays] of byRoom) {
    const sorted = [...stays].sort((a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[j].checkIn >= sorted[i].checkOut) break; // sorted by checkIn: no further j can overlap
        if (sorted[j].checkIn < sorted[i].checkOut && sorted[i].checkIn < sorted[j].checkOut) {
          overlaps.push({ roomSlug, a: sorted[i], b: sorted[j] });
        }
      }
    }
  }
  return overlaps;
}

// ---------------------------------------------------------------------------
// Report (task 4.1, 4.2)
// ---------------------------------------------------------------------------

function buildReport(rawTotal, accepted, rejected, corrected, overlaps) {
  const byYear = new Map();
  for (const c of accepted) {
    if (!byYear.has(c.year)) byYear.set(c.year, { total: 0, byStatus: new Map(), incomeApproved: 0, byRoom: new Map() });
    const bucket = byYear.get(c.year);
    bucket.total += 1;
    bucket.byStatus.set(c.reservationStatus, (bucket.byStatus.get(c.reservationStatus) ?? 0) + 1);
    bucket.byRoom.set(c.roomSlug, (bucket.byRoom.get(c.roomSlug) ?? 0) + 1);
    if (c.payment?.status === "approved") bucket.incomeApproved += c.neto;
  }
  return { rawTotal, acceptedTotal: accepted.length, rejected, corrected, overlaps, byYear };
}

function formatClp(value) {
  return `$${Math.round(value).toLocaleString("es-CL")}`;
}

function printReport(report) {
  console.log(`\n=== Lectura ===`);
  console.log(`Filas leídas de la planilla: ${report.rawTotal}`);
  console.log(`Filas aceptadas: ${report.acceptedTotal}  |  rechazadas: ${report.rejected.length}  |  corregidas: ${report.corrected.length}`);

  console.log(`\n=== Desglose por año ===`);
  for (const [year, bucket] of [...report.byYear].sort((a, b) => a[0] - b[0])) {
    const statusStr = [...bucket.byStatus].map(([s, n]) => `${s}=${n}`).join(", ");
    const roomStr = [...bucket.byRoom].map(([r, n]) => `${r}=${n}`).join(", ");
    console.log(`  ${year}: ${bucket.total} reservas (${statusStr}) | piezas: ${roomStr} | ingresos aprobados: ${formatClp(bucket.incomeApproved)}`);
  }

  if (report.corrected.length > 0) {
    console.log(`\n=== Filas corregidas (${report.corrected.length}) ===`);
    for (const c of report.corrected) {
      console.log(`  ${c.year}·f${c.row} ${c.guest.firstName} ${c.guest.lastName}: ${c.corrections.join("; ")}`);
    }
  }

  if (report.rejected.length > 0) {
    console.log(`\n=== Filas rechazadas (${report.rejected.length}) ===`);
    for (const r of report.rejected) {
      console.log(`  ${r.year}·f${r.row} ${r.nombre ?? "(sin nombre)"}: ${r.reason}`);
    }
  }

  if (report.overlaps.length > 0) {
    console.log(`\n=== Noches con doble reserva (${report.overlaps.length} pares, no se rechazan) ===`);
    for (const { roomSlug, a, b } of report.overlaps) {
      console.log(
        `  ${roomSlug}: f${a.row}(${a.year}) ${a.guest.firstName} ${a.guest.lastName} ${a.checkIn}→${a.checkOut}  ✗  f${b.row}(${b.year}) ${b.guest.firstName} ${b.guest.lastName} ${b.checkIn}→${b.checkOut}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Database connection and environment validation (task 5.1). Same guard as
// scripts/load-room-content.mjs: refuse a missing or mock DATABASE_URL.
// ---------------------------------------------------------------------------

function requireRealDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || /mock/i.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL debe estar definida en el entorno con un valor real (no mock). " +
        "Este script nunca se ejecuta contra el contexto simulado de la aplicación."
    );
  }
  return databaseUrl;
}

async function resolveRoomIdsBySlug(sql) {
  const slugs = Object.values(ROOM_SLUG_BY_PIEZA);
  const rows = await sql`select id, slug from rooms where slug in ${sql(slugs)}`;
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) {
    throw new Error(
      `Faltan en el catálogo las habitaciones: ${missing.join(", ")}. No se puede continuar.`
    );
  }
  return bySlug;
}

// ---------------------------------------------------------------------------
// Deterministic public id (task 5.2, design.md decision 6)
// ---------------------------------------------------------------------------

function generatePublicId(candidate) {
  const fingerprint = [
    candidate.year,
    candidate.row,
    candidate.guest.firstName,
    candidate.guest.lastName,
    candidate.checkIn,
    candidate.checkOut,
    candidate.roomSlug,
  ].join("|");
  const hash = crypto.createHash("sha256").update(fingerprint).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.toString("hex");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return `VV-${uuid}`;
}

const PUBLIC_ID_PATTERN =
  /^VV-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Cleanup (task 5.3, design.md decision 7). Order follows the foreign-key
// graph of src/persistence/schema.ts; rooms, room_images, amenities,
// room_amenities, channel_connections and
// company_quotation_breakfast_catalog are never touched.
// ---------------------------------------------------------------------------

const CLEANUP_TABLES_IN_ORDER = [
  "payment_events",
  "payments",
  "reservation_items",
  "channel_sync_tasks",
  "notification_outbox",
  "operational_alerts",
  "reservations",
  "reservation_holds",
  "guests",
  "room_blocks",
  "assistant_interactions",
  "audit_events",
  "company_quotation_lines",
  "company_quotations",
];

async function cleanupTestData(sql) {
  for (const table of CLEANUP_TABLES_IN_ORDER) {
    await sql.unsafe(`delete from ${table}`);
  }
}

const PRESERVED_TABLES = [
  "rooms",
  "room_images",
  "amenities",
  "room_amenities",
  "channel_connections",
  "company_quotation_breakfast_catalog",
];

async function countPreservedTables(sql) {
  const counts = {};
  for (const table of PRESERVED_TABLES) {
    const [{ count }] = await sql.unsafe(`select count(*)::int as count from ${table}`);
    counts[table] = count;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Insertion (task 5.4)
// ---------------------------------------------------------------------------

async function insertCandidate(sql, roomIds, candidate) {
  const publicId = generatePublicId(candidate);
  const roomId = roomIds.get(candidate.roomSlug);

  const [guest] = await sql`
    insert into guests (first_name, last_name, email, phone)
    values (${candidate.guest.firstName}, ${candidate.guest.lastName}, ${candidate.guest.email}, ${candidate.guest.phone})
    returning id
  `;

  const [reservation] = await sql`
    insert into reservations (
      public_id, guest_id, check_in, check_out, total_clp, origin, payment_mode, status
    ) values (
      ${publicId}, ${guest.id}, ${candidate.checkIn}, ${candidate.checkOut}, ${candidate.neto},
      ${candidate.origin}, 'pay_at_property', ${candidate.reservationStatus}
    )
    returning id
  `;

  await sql`
    insert into reservation_items (reservation_id, room_id, nights, nightly_price_clp, charges_clp, subtotal_clp)
    values (${reservation.id}, ${roomId}, ${candidate.nights}, ${candidate.valorNoche}, 0, ${candidate.neto})
  `;

  if (candidate.payment) {
    await sql`
      insert into payments (
        reservation_id, provider, external_reference, amount_clp, currency, mode, status, received_at
      ) values (
        ${reservation.id}, 'historical_import', ${`import:${publicId}`}, ${candidate.neto}, 'CLP',
        'pay_at_property', ${candidate.payment.status}, ${`${candidate.checkOut}T12:00:00Z`}
      )
    `;
  }

  return { publicId, reservationId: reservation.id };
}

// ---------------------------------------------------------------------------
// Transaction (task 5.5): cleanup + insertion commit or roll back together.
// ---------------------------------------------------------------------------

async function runCommit(sql, accepted, roomIds) {
  return sql.begin(async (tx) => {
    await cleanupTestData(tx);
    const inserted = [];
    for (const candidate of accepted) {
      inserted.push(await insertCandidate(tx, roomIds, candidate));
    }
    return inserted;
  });
}

export {
  parseArgs,
  printUsage,
  readXlsxSheet,
  readHistoricalRows,
  serialToIsoDate,
  serialToYmd,
  isoDateToSerial,
  addDaysToIsoDate,
  daysBetweenIsoDates,
  DEFAULT_MANIFEST,
  SHEET_NAME,
  BLOCKS,
  ROOM_SLUG_BY_PIEZA,
  resolveRoomSlug,
  resolveOrigin,
  resolveStatus,
  resolveGuest,
  EXPLICIT_CORRECTIONS,
  sanitizeRow,
  fillMedianNightlyPrices,
  sanitizeAllRows,
  findOverlappingNights,
  buildReport,
  printReport,
  formatClp,
  requireRealDatabaseUrl,
  resolveRoomIdsBySlug,
  generatePublicId,
  PUBLIC_ID_PATTERN,
  CLEANUP_TABLES_IN_ORDER,
  PRESERVED_TABLES,
  cleanupTestData,
  countPreservedTables,
  insertCandidate,
  runCommit,
};

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return;
  }

  const databaseUrl = requireRealDatabaseUrl();
  const { all } = readHistoricalRows(args.manifestPath);
  const today = new Date().toISOString().slice(0, 10);
  const { accepted, rejected, corrected } = sanitizeAllRows(all, today);
  const overlaps = findOverlappingNights(accepted);
  const report = buildReport(all.length, accepted, rejected, corrected, overlaps);
  printReport(report);

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const roomIds = await resolveRoomIdsBySlug(sql);

    if (!args.commit) {
      console.log(
        "\nSimulación completa. Nada fue escrito en la base de datos. Ejecuta con --commit para aplicar los cambios."
      );
      return;
    }

    const preservedBefore = await countPreservedTables(sql);
    const inserted = await runCommit(sql, accepted, roomIds);
    const preservedAfter = await countPreservedTables(sql);

    console.log(`\n=== Escritura aplicada ===`);
    console.log(`Reservas insertadas: ${inserted.length}`);
    console.log(
      `Tablas preservadas (antes → después): ${PRESERVED_TABLES.map((t) => `${t}=${preservedBefore[t]}→${preservedAfter[t]}`).join(", ")}`
    );
    const changed = PRESERVED_TABLES.filter((t) => preservedBefore[t] !== preservedAfter[t]);
    if (changed.length > 0) {
      console.warn(`ADVERTENCIA: cambiaron tablas que debían preservarse: ${changed.join(", ")}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
}
