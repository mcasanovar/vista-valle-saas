import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const reservationStatusEnum = pgEnum("reservation_status", [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);
export const reservationOriginEnum = pgEnum("reservation_origin", [
  "website",
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
]);
export const paymentModeEnum = pgEnum("payment_mode", [
  "pay_now",
  "pay_at_property",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "requires_action",
]);
export const channelEnum = pgEnum("channel", ["airbnb", "booking"]);
export const channelTaskStatusEnum = pgEnum("channel_task_status", [
  "pending",
  "completed",
]);
export const channelPaymentBehaviorEnum = pgEnum("channel_payment_behavior", [
  "auto_approved",
  "pay_at_property",
]);
export const channelConnectionPollStatusEnum = pgEnum(
  "channel_connection_poll_status",
  ["ok", "error"]
);
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "processing",
  "retrying",
  "delivered",
  "failed",
]);
export const companyQuotationStatusEnum = pgEnum("company_quotation_status", [
  "accepted",
  "delivery_failed",
  "delivered",
]);
export const assistantInteractionStatusEnum = pgEnum(
  "assistant_interaction_status",
  ["proposed", "confirmed", "cancelled", "failed", "expired"]
);
/** Only `channel_sync_conflict` is written today; new values are additive as future alert-events (e.g. an OTA feed going stale) get built. */
export const operationalAlertKindEnum = pgEnum("operational_alert_kind", [
  "channel_sync_conflict",
]);

export const rooms = pgTable(
  "rooms",
  {
    id: id(),
    slug: varchar("slug", { length: 160 }),
    name: varchar("name", { length: 200 }),
    description: text("description"),
    capacity: integer("capacity"),
    bedCount: integer("bed_count"),
    bedConfiguration: varchar("bed_configuration", { length: 200 }),
    bathroomDescription: varchar("bathroom_description", { length: 200 }),
    baseNightlyPriceClp: integer("base_nightly_price_clp"),
    active: boolean("active").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("rooms_slug_unique").on(table.slug),
    check(
      "rooms_capacity_positive",
      sql`${table.capacity} IS NULL OR ${table.capacity} > 0`
    ),
    check(
      "rooms_bed_count_positive",
      sql`${table.bedCount} IS NULL OR ${table.bedCount} > 0`
    ),
    check(
      "rooms_nightly_price_positive",
      sql`${table.baseNightlyPriceClp} IS NULL OR ${table.baseNightlyPriceClp} > 0`
    ),
    check(
      "rooms_active_complete",
      sql`${table.active} = false OR (${table.slug} IS NOT NULL AND ${table.name} IS NOT NULL AND ${table.capacity} IS NOT NULL AND ${table.bedCount} IS NOT NULL AND ${table.baseNightlyPriceClp} IS NOT NULL)`
    ),
  ]
);

export const roomOccupancyPrices = pgTable(
  "room_occupancy_prices",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    occupancy: integer("occupancy").notNull(),
    priceClp: integer("price_clp").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("room_occupancy_prices_room_occupancy_unique").on(
      table.roomId,
      table.occupancy
    ),
    check(
      "room_occupancy_prices_occupancy_positive",
      sql`${table.occupancy} > 0`
    ),
    check(
      "room_occupancy_prices_price_positive",
      sql`${table.priceClp} > 0`
    ),
  ]
);

export const roomImages = pgTable(
  "room_images",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    storagePath: text("storage_path").notNull(),
    altText: text("alt_text"),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("room_images_room_position_unique").on(
      table.roomId,
      table.position
    ),
    check("room_images_position_non_negative", sql`${table.position} >= 0`),
  ]
);

export const amenities = pgTable(
  "amenities",
  {
    id: id(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("amenities_slug_unique").on(table.slug)]
);

export const roomAmenities = pgTable(
  "room_amenities",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("room_amenities_room_amenity_unique").on(
      table.roomId,
      table.amenityId
    ),
  ]
);

export const guests = pgTable("guests", {
  id: id(),
  firstName: varchar("first_name", { length: 160 }).notNull(),
  lastName: varchar("last_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 80 }).notNull(),
  rut: varchar("rut", { length: 32 }),
  company: varchar("company", { length: 200 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    publicId: varchar("public_id", { length: 80 }).notNull(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "restrict" }),
    checkIn: date("check_in", { mode: "string" }).notNull(),
    checkOut: date("check_out", { mode: "string" }).notNull(),
    totalClp: integer("total_clp").notNull(),
    origin: reservationOriginEnum("origin").notNull(),
    paymentMode: paymentModeEnum("payment_mode").notNull(),
    status: reservationStatusEnum("status").notNull(),
    guestComment: text("guest_comment"),
    /** Set only for a reservation created from an inbound channel-sync event (see `channel_connections`); identifies the source event so a later poll recognizes it instead of duplicating the reservation. */
    externalPlatform: channelEnum("external_platform"),
    externalRef: varchar("external_ref", { length: 200 }),
    invoiceRequested: boolean("invoice_requested").default(false).notNull(),
    invoiceName: varchar("invoice_name", { length: 200 }),
    invoiceRut: varchar("invoice_rut", { length: 32 }),
    invoicePhone: varchar("invoice_phone", { length: 80 }),
    invoiceBusinessActivity: varchar("invoice_business_activity", {
      length: 200,
    }),
    invoiceEmail: varchar("invoice_email", { length: 320 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("reservations_public_id_unique").on(table.publicId),
    index("reservations_check_in_check_out_idx").on(
      table.checkIn,
      table.checkOut
    ),
    /** NULLs never collide in Postgres, so manual/website reservations (both columns NULL) are unaffected; only two rows sharing the same real (platform, ref) pair collide. */
    uniqueIndex("reservations_external_platform_ref_unique").on(
      table.externalPlatform,
      table.externalRef
    ),
    check(
      "reservations_interval_valid",
      sql`${table.checkOut} > ${table.checkIn}`
    ),
    check("reservations_total_non_negative", sql`${table.totalClp} >= 0`),
    check(
      "reservations_invoice_request_complete",
      sql`${table.invoiceRequested} = false OR (${table.invoiceName} IS NOT NULL AND ${table.invoiceRut} IS NOT NULL AND ${table.invoicePhone} IS NOT NULL AND ${table.invoiceBusinessActivity} IS NOT NULL AND ${table.invoiceEmail} IS NOT NULL)`
    ),
    check(
      "reservations_external_ref_consistent",
      sql`(${table.externalPlatform} IS NULL) = (${table.externalRef} IS NULL)`
    ),
  ]
);

export const reservationItems = pgTable(
  "reservation_items",
  {
    id: id(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    nights: integer("nights").notNull(),
    guestCount: integer("guest_count").default(1).notNull(),
    nightlyPriceClp: integer("nightly_price_clp").notNull(),
    chargesClp: integer("charges_clp").default(0).notNull(),
    subtotalClp: integer("subtotal_clp").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("reservation_items_reservation_room_unique").on(
      table.reservationId,
      table.roomId
    ),
    index("reservation_items_room_reservation_idx").on(
      table.roomId,
      table.reservationId
    ),
    check("reservation_items_nights_positive", sql`${table.nights} > 0`),
    check(
      "reservation_items_guest_count_positive",
      sql`${table.guestCount} > 0`
    ),
    check(
      "reservation_items_nightly_price_positive",
      sql`${table.nightlyPriceClp} > 0`
    ),
    check(
      "reservation_items_charges_non_negative",
      sql`${table.chargesClp} >= 0`
    ),
    check(
      "reservation_items_subtotal_non_negative",
      sql`${table.subtotalClp} >= 0`
    ),
  ]
);

export const reservationHolds = pgTable(
  "reservation_holds",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "restrict" }),
    checkIn: date("check_in", { mode: "string" }).notNull(),
    checkOut: date("check_out", { mode: "string" }).notNull(),
    guestCount: integer("guest_count").notNull(),
    nightlyPriceClp: integer("nightly_price_clp").notNull(),
    chargesClp: integer("charges_clp").default(0).notNull(),
    totalClp: integer("total_clp").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("reservation_holds_room_interval_expiry_idx").on(
      table.roomId,
      table.checkIn,
      table.checkOut,
      table.expiresAt
    ),
    check(
      "reservation_holds_interval_valid",
      sql`${table.checkOut} > ${table.checkIn}`
    ),
    check(
      "reservation_holds_guest_count_positive",
      sql`${table.guestCount} > 0`
    ),
    check(
      "reservation_holds_nightly_price_positive",
      sql`${table.nightlyPriceClp} > 0`
    ),
    check(
      "reservation_holds_charges_non_negative",
      sql`${table.chargesClp} >= 0`
    ),
    check("reservation_holds_total_non_negative", sql`${table.totalClp} >= 0`),
  ]
);

export const roomBlocks = pgTable(
  "room_blocks",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    checkIn: date("check_in", { mode: "string" }).notNull(),
    checkOut: date("check_out", { mode: "string" }).notNull(),
    reason: text("reason").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    removedByUserId: uuid("removed_by_user_id"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    assistantInteractionId: uuid("assistant_interaction_id").references(
      () => assistantInteractions.id,
      { onDelete: "restrict" }
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("room_blocks_room_interval_idx").on(
      table.roomId,
      table.checkIn,
      table.checkOut
    ),
    check(
      "room_blocks_interval_valid",
      sql`${table.checkOut} > ${table.checkIn}`
    ),
    check(
      "room_blocks_removal_consistent",
      sql`(${table.removedAt} IS NULL) = (${table.removedByUserId} IS NULL)`
    ),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    reservationId: uuid("reservation_id").references(() => reservations.id, {
      onDelete: "restrict",
    }),
    holdId: uuid("hold_id").references(() => reservationHolds.id, {
      onDelete: "restrict",
    }),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 200 }),
    externalReference: varchar("external_reference", { length: 200 }).notNull(),
    amountClp: integer("amount_clp").notNull(),
    currency: varchar("currency", { length: 3 }).default("CLP").notNull(),
    mode: paymentModeEnum("mode").notNull(),
    paymentMethod: varchar("payment_method", { length: 80 }),
    status: paymentStatusEnum("status").notNull(),
    /** Cumulative amount refunded so far; only reaches `amountClp` on a full refund (see `payments.status = 'refunded'`). */
    refundedAmountClp: integer("refunded_amount_clp").default(0).notNull(),
    recordedByUserId: uuid("recorded_by_user_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("payments_provider_payment_unique").on(
      table.provider,
      table.providerPaymentId
    ),
    index("payments_reservation_status_idx").on(
      table.reservationId,
      table.status
    ),
    check("payments_amount_positive", sql`${table.amountClp} > 0`),
    check(
      "payments_reference_target",
      sql`(${table.reservationId} IS NOT NULL) OR (${table.holdId} IS NOT NULL)`
    ),
  ]
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: id(),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "restrict",
    }),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 200 }).notNull(),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_unique").on(
      table.provider,
      table.providerEventId
    ),
    index("payment_events_payment_occurred_idx").on(
      table.paymentId,
      table.occurredAt
    ),
  ]
);

export const channelSyncTasks = pgTable(
  "channel_sync_tasks",
  {
    id: id(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    channel: channelEnum("channel").notNull(),
    status: channelTaskStatusEnum("status").default("pending").notNull(),
    completedByUserId: uuid("completed_by_user_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("channel_sync_tasks_reservation_channel_unique").on(
      table.reservationId,
      table.channel
    ),
    index("channel_sync_tasks_status_idx").on(table.status, table.createdAt),
    check(
      "channel_sync_tasks_completion_consistent",
      sql`(${table.completedAt} IS NULL) = (${table.completedByUserId} IS NULL)`
    ),
  ]
);

export const channelConnections = pgTable(
  "channel_connections",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    platform: channelEnum("platform").notNull(),
    paymentBehavior: channelPaymentBehaviorEnum("payment_behavior").notNull(),
    /** URL/credential to poll for inbound events. Never re-served to the browser once set (see `channel-calendar-sync` spec: "write-only after saving"); only presence is exposed. */
    inboundFeedUrl: text("inbound_feed_url"),
    /** Unguessable token identifying this connection's outbound `.ics` URL; regenerating it invalidates the previous link. */
    outboundToken: varchar("outbound_token", { length: 64 }).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastPollStatus: channelConnectionPollStatusEnum("last_poll_status"),
    lastPollEventCount: integer("last_poll_event_count"),
    lastPollError: text("last_poll_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("channel_connections_room_platform_unique").on(
      table.roomId,
      table.platform
    ),
    uniqueIndex("channel_connections_outbound_token_unique").on(
      table.outboundToken
    ),
    check(
      "channel_connections_poll_result_consistent",
      sql`${table.lastPolledAt} IS NULL OR ${table.lastPollStatus} IS NOT NULL`
    ),
  ]
);

export const auditEvents = pgTable("audit_events", {
  id: id(),
  actorUserId: uuid("actor_user_id"),
  action: varchar("action", { length: 160 }).notNull(),
  entityType: varchar("entity_type", { length: 120 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: id(),
    quotationId: uuid("quotation_id").references(() => companyQuotations.id, {
      onDelete: "restrict",
    }),
    reservationId: uuid("reservation_id").references(() => reservations.id, {
      onDelete: "restrict",
    }),
    type: varchar("type", { length: 120 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: notificationStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("notification_outbox_idempotency_key_unique").on(
      table.idempotencyKey
    ),
    index("notification_outbox_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    index("notification_outbox_quotation_idx").on(table.quotationId),
    check(
      "notification_outbox_attempts_non_negative",
      sql`${table.attempts} >= 0`
    ),
  ]
);

export const companyQuotations = pgTable(
  "company_quotations",
  {
    id: id(),
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
    company: varchar("company", { length: 200 }).notNull(),
    contact: varchar("contact", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 80 }).notNull(),
    requireParking: boolean("require_parking").notNull().default(false),
    message: text("message").notNull(),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    guestCount: integer("guest_count").notNull(),
    capacity: integer("capacity").notNull(),
    nights: integer("nights").notNull(),
    breakfastRequested: boolean("breakfast_requested").notNull().default(false),
    breakfastQuantity: integer("breakfast_quantity"),
    breakfastUnitPriceClpSnapshot: integer("breakfast_unit_price_clp_snapshot"),
    breakfastSubtotalClp: integer("breakfast_subtotal_clp")
      .notNull()
      .default(0),
    totalClp: integer("total_clp").notNull(),
    status: companyQuotationStatusEnum("status").default("accepted").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("company_quotations_idempotency_key_unique").on(
      table.idempotencyKey
    ),
    index("company_quotations_created_idx").on(table.createdAt),
    check(
      "company_quotations_guest_count_positive",
      sql`${table.guestCount} > 0`
    ),
    check("company_quotations_capacity_positive", sql`${table.capacity} > 0`),
    check("company_quotations_nights_positive", sql`${table.nights} > 0`),
    check("company_quotations_total_non_negative", sql`${table.totalClp} >= 0`),
    check(
      "company_quotations_breakfast_detail_when_requested",
      sql`(NOT ${table.breakfastRequested}) OR (${table.breakfastQuantity} > 0 AND ${table.breakfastUnitPriceClpSnapshot} >= 0 AND ${table.breakfastSubtotalClp} >= 0)`
    ),
  ]
);

export const companyQuotationBreakfastCatalog = pgTable(
  "company_quotation_breakfast_catalog",
  {
    id: id(),
    description: text("description").notNull(),
    unitPriceClp: integer("unit_price_clp").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "company_quotation_breakfast_catalog_price_non_negative",
      sql`${table.unitPriceClp} >= 0`
    ),
  ]
);

export const companyQuotationLines = pgTable(
  "company_quotation_lines",
  {
    id: id(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => companyQuotations.id, { onDelete: "cascade" }),
    roomSlug: varchar("room_slug", { length: 160 }).notNull(),
    roomNameSnapshot: varchar("room_name_snapshot", { length: 200 }).notNull(),
    capacitySnapshot: integer("capacity_snapshot").notNull(),
    nightlyPriceClpSnapshot: integer("nightly_price_clp_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    nights: integer("nights").notNull(),
    subtotalClp: integer("subtotal_clp").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("company_quotation_lines_quotation_idx").on(table.quotationId),
    check(
      "company_quotation_lines_capacity_positive",
      sql`${table.capacitySnapshot} > 0`
    ),
    check(
      "company_quotation_lines_price_positive",
      sql`${table.nightlyPriceClpSnapshot} > 0`
    ),
    check(
      "company_quotation_lines_quantity_positive",
      sql`${table.quantity} > 0`
    ),
    check("company_quotation_lines_nights_positive", sql`${table.nights} > 0`),
    check(
      "company_quotation_lines_subtotal_non_negative",
      sql`${table.subtotalClp} >= 0`
    ),
  ]
);

export const assistantInteractions = pgTable(
  "assistant_interactions",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").notNull(),
    instruction: text("instruction").notNull(),
    interpretation: jsonb("interpretation"),
    corrections: jsonb("corrections"),
    status: assistantInteractionStatusEnum("status").notNull(),
    proposalToken: varchar("proposal_token", { length: 200 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    result: jsonb("result"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("assistant_interactions_proposal_token_unique").on(
      table.proposalToken
    ),
    index("assistant_interactions_status_expiry_idx").on(
      table.status,
      table.expiresAt
    ),
  ]
);

export const operationalAlerts = pgTable(
  "operational_alerts",
  {
    id: id(),
    kind: operationalAlertKindEnum("kind").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    reservationId: uuid("reservation_id").references(() => reservations.id, {
      onDelete: "restrict",
    }),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("operational_alerts_created_at_idx").on(table.createdAt)]
);
