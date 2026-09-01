import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("manual reservation client import boundary", () => {
  it("uses the browser-safe date contract instead of the server-capable availability barrel", () => {
    const form = readProjectFile(
      "src/features/admin/manual-reservation-form.tsx"
    );
    const contract = readProjectFile(
      "src/features/admin/manual-reservation-contract.ts"
    );
    const clientDateOnly = readProjectFile(
      "src/features/availability/client-date-only.ts"
    );

    expect(form).toContain('from "@/features/availability/client-date-only"');
    expect(form).not.toContain('from "@/features/availability"');
    expect(contract).toContain(
      'from "@/features/availability/client-date-only"'
    );
    expect(contract).not.toContain('from "@/features/availability"');
    expect(clientDateOnly).toContain('from "./date-only"');
    expect(clientDateOnly).not.toMatch(/import\s+["']server-only["'];?/);
  });
});
