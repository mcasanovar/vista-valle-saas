## 1. Project foundation

- [x] 1.1 Initialize the Next.js App Router project with TypeScript, linting, formatting, package scripts, and a pinned lockfile
- [x] 1.2 Add Tailwind CSS, shared design tokens, typography, responsive breakpoints, and the warm Vista Valle color foundation
- [x] 1.3 Create the feature-first module boundaries and shared Atomic Design directories with enforced import conventions
- [x] 1.4 Add environment validation for Supabase, database, Mercado Pago, AI, email, site URL, timezone, and operational settings
- [x] 1.5 Configure Vitest, Testing Library, Playwright, and separate test environment variables

## 2. Database, authentication, and storage

- [x] 2.1 Configure typed Supabase, SSR session, and server-only database boundaries with mock adapters as the default for development and tests, while keeping production clients fail-closed and inactive without real credentials
- [x] 2.2 Define Drizzle enums and tables for rooms, images, amenities, guests, reservations, holds, blocks, payments, payment events, channel tasks, audit events, notification outbox, and assistant interactions
- [x] 2.3 Add indexes, foreign keys, uniqueness rules, date checks, monetary checks, migration scripts, and offline verification of the generated PostgreSQL schema without requiring a live database
- [x] 2.4 Implement mock seed and fixture loading for three unpublished room records while rejecting publication of incomplete required commercial data
- [x] 2.5 Configure typed Supabase Storage boundaries, a no-network mock adapter for development/tests, and production bucket/access-rule artifacts without provisioning a live project yet
- [x] 2.6 Configure typed Supabase Auth boundaries with mock SSR sessions for development/tests, public administrator signup disabled, protected admin routes, an administrator allowlist, and RLS defense-in-depth artifacts; defer live Supabase verification to production readiness

## 3. Shared UI and public lodging site

- [x] 3.1 Build accessible atoms for typography, buttons, links, inputs, labels, icons, badges, feedback, and loading states
- [x] 3.2 Build reusable molecules for form fields, date fields, guest counters, prices, amenities, contact links, and status presentation
- [x] 3.3 Build public organisms for header, mobile navigation, hero, booking search, room card, room gallery, services, company CTA, location, final CTA,  and footer
- [x] 3.4 Compose the responsive home template in the agreed conversion order and connect it to configured content
- [x] 3.5 Implement the room catalogue and slug-based room detail pages from active room data, using explicitly labelled fictional fixtures only under the mock context for front-end validation and rejecting them in production
- [x] 3.6 Implement the company enquiry path using the configured contact channel without routing it through individual checkout, with a labelled no-send demonstration form allowed only under the mock context until an approved channel is configured
- [x] 3.7 Add metadata, canonical URLs, Open Graph, sitemap, robots, structured lodging data, semantic markup, keyboard support, and image optimization
- [x] 3.8 Verify public pages across mobile, tablet, notebook, and desktop accessibility breakpoints

## 4. Availability and reservation domain

- [x] 4.1 Implement date-only lodging utilities for `America/Santiago`, `[check-in, check-out)` intervals, nights, and overlap detection
- [x] 4.2 Implement server-authoritative guest validation, capacity validation, nightly pricing, applicable charges, and frozen reservation totals
- [x] 4.3 Implement availability queries that combine active reservations, unexpired holds, and room blocks
- [x] 4.4 Implement per-room transactional locking and final overlap validation for holds, reservations, and blocks
- [x] 4.5 Implement creation and expiry behavior for payment holds with configurable duration (deferred/unused in this MVP: prepared groundwork for a future online-payment phase; no MVP flow creates a hold — see design.md decision 7)
- [x] 4.6 Implement immediate confirmed reservations for `PAY_AT_PROPERTY` with a pending payment record
- [x] 4.7 Implement reservation identifiers and state transitions for confirmed, cancelled, completed, and no-show states
- [x] 4.8 Add unit and PostgreSQL integration tests for date boundaries, same-day turnover, pricing, capacity, hold expiry, and concurrent reservation attempts

## 5. Public booking experience

- [x] 5.1 Build the availability search flow for dates, guests, and optional preselected room
- [x] 5.2 Build the guest information form with validated required and optional fields
- [x] 5.3 Build the booking summary with dates, nights, guests, frozen nightly price, charges, and total
- [x] 5.4 Connect the pay-at-property path to immediate reservation creation and its confirmation page
- [x] 5.5 Prevent duplicate submissions and revalidate availability at every committing boundary

## 6. Administrative operations

- [x] 6.1 Build the protected admin shell, navigation, responsive dashboard, and summary of urgent operational items
- [x] 6.2 Build the room calendar showing reservations, holds, blocks, origin, status, and detail navigation
- [x] 6.3 Build reservation listing, filters, detail view, permitted edits, cancellation, completion, and no-show actions
- [x] 6.4 Build manual reservation creation for Airbnb, Booking, phone, WhatsApp, and admin origins using the shared availability service
- [x] 6.5 Build manual room-block creation and removal with interval, reason, authorization, conflict validation, and audit events
- [x] 6.6 Build pay-at-property collection recording with amount, date, medium, actor, and payment state update
- [x] 6.7 Create Airbnb and Booking sync tasks for confirmed website reservations and build the pending/completed checklist workflow
- [x] 6.8 Display notification failures, payment anomalies, and financial follow-up without exposing provider secrets

## 7. Calendar AI assistant

- [x] 7.1 Define the provider-independent `CREATE_ROOM_BLOCK` schema, supported Spanish intent, room aliases, and explicitly unsupported actions
- [x] 7.2 Implement a provider-independent mock interpreter for structured interpretation without automatic tool execution, database access, network requests, or AI credentials; defer Vercel AI SDK integration to a future OpenSpec change
- [x] 7.3 Implement deterministic room resolution, Chilean date interpretation, missing-field detection, absolute-date presentation, and proposal expiry
- [x] 7.4 Build the assistant conversation UI for an instruction, clarification, correction, preview, confirmation, cancellation, and mock-response failure; use one deterministic mock AI response in this MVP and defer real provider integration to a future OpenSpec change
- [x] 7.5 Bind confirmed previews to short-lived proposal tokens and execute them only through the normal authorized block service
- [x] 7.6 Persist the original instruction, structured interpretation, corrections, approval, actor, and execution result for audit
- [x] 7.7 Add tests for omitted rooms, missing years, relative dates, aliases, invented rooms, unsupported actions, conflicts, tampered previews, and unavailable AI

## 8. Transactional notifications

- [x] 8.1 Implement the notification outbox writer in the same transactions that confirm reservations and payments
- [x] 8.2 Create React Email templates for pay-at-property confirmation and administrator new-reservation alerts
- [x] 8.3 Implement the Resend adapter, idempotent delivery worker, retry policy, delivery records, and privacy-safe error capture
- [x] 8.4 Add a scheduled outbox processor that tolerates serverless limits and exposes failed delivery status in admin
- [x] 8.5 Test that provider failure never rolls back a reservation and that retries do not duplicate delivered emails

## 9. End-to-end verification and hardening

- [x] 9.1 Add Playwright coverage for room discovery, availability search, pay-at-property reservation, and confirmation
- [x] 9.2 Add Playwright coverage for administrator login, manual external reservation, room block, payment collection, and channel-sync completion
- [x] 9.3 Add Playwright coverage for assistant preview, human confirmation, conflict rejection, and manual fallback
- [x] 9.4 Review authorization, RLS, secrets, rate limits, personal-data logging, unguessable public identifiers, and common web security headers
- [x] 9.5 Run automated accessibility checks, keyboard journeys, responsive visual checks, SEO validation, and production performance profiling
- [x] 9.6 Add structured logs and Sentry hooks correlated by reservation and payment identifiers with personal-data redaction

## 10. Production readiness and launch

- [ ] 10.1 Load approved room names, photographs, prices, capacities, services, policies, contact details, location, and check-in/out information
- [ ] 10.2 Configure production Supabase, storage, backups, administrator account, domain, Resend sender, and AI provider
- [ ] 10.3 Reconcile all existing external reservations and manual blocks into the admin calendar before opening web availability
- [ ] 10.4 Add and verify the operational booking feature switch, rollback procedure, and outbox recovery
- [ ] 10.5 Perform final acceptance testing with Vista Valle on mobile and desktop, then enable direct reservations

## 11. Reserva pública multi-habitación y solicitud de factura

- [x] 11.1 Rework the reservation persistence and mock contracts into reservation headers and room items with shared lodging dates, frozen item subtotals, aggregate totals, and conditional invoice-request data; verify schema and contract tests cover one and multiple room reservations.
- [x] 11.2 Update availability, pricing, reservation creation, cancellation, admin detail, and channel-sync behavior to operate on every item of an all-or-nothing reservation, acquiring rooms in stable order and preserving existing single-room behavior; verify concurrency tests reject a cart when any selected room conflicts and leave no partial reservation.
- [x] 11.3 Build the accessible public room-selection state that supports add/remove from availability results and room detail, retains shared dates, rechecks selection after date changes, and displays per-room subtotals and aggregate total; verify component and Playwright journeys cover both entry points.
- [x] 11.4 Update the public checkout to remove guest-count input, collect required booking-holder data, and conditionally show required invoice-request fields; validate Chilean RUT on client and server and verify no invoice data is persisted when the option is disabled.
- [x] 11.5 Update confirmation and transactional notification contracts/templates to show all reserved rooms and deduplicate normalized guest and invoice recipients; verify mock outbox tests produce two recipients only when their addresses differ.
- [x] 11.6 Add end-to-end coverage for a multi-room reservation with and without an invoice request, including confirmation totals, conditional validation, recipient deduplication, and all-or-nothing conflict handling.

## 12. Validación de fechas mínimas de disponibilidad

- [x] 12.1 Rechazar autoritativamente consultas públicas con entrada anterior a hoy en `America/Santiago` o salida anterior a mañana/no posterior a la entrada; reflejar los mínimos en landing y resultados, y verificar con pruebas unitarias, de ruta y de interfaz los casos de fecha pasada, entrada hoy y salida mañana.
