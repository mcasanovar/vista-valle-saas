## 1. Query contract and server composition

- [x] 1.1 Define and test the canonical availability-results query contract for `checkIn`, `checkOut`, `guests`, and optional `room`, including normalization, field-specific invalid states, and safe URL serialization
- [x] 1.2 Add a server-only results composition service that reuses the authoritative availability use case, joins only authorized room identifiers to presentation data, and preserves the production fail-closed boundary
- [x] 1.3 Add unit tests for available rooms, capacity filtering, no results, unavailable preselection, malformed direct URLs, and absence of external provider calls under `mock`

## 2. Shared search and navigation

- [x] 2.1 Evolve the shared booking-search organism to support named GET criteria, inline accessible validation, pending semantics, duplicate-submit prevention, and the optional room criterion without duplicating the home and results forms
- [x] 2.2 Route valid searches from the home to `/disponibilidad`, show immediate transition feedback without artificial delay, and keep invalid searches on the home with actionable field errors
- [x] 2.3 Preserve dates, guests, and optional room context between room detail, availability results, browser history, and the action used to continue from an available room
- [x] 2.4 Update component and integration tests for home submission, invalid input, preselected rooms, query serialization, and back/forward state restoration

## 3. Availability results page

- [x] 3.1 Build the public `/disponibilidad` route shell with existing Vista Valle navigation and tokens, a descriptive heading and search summary, the prefilled search organism at the top, and `noindex,follow` plus canonical metadata
- [x] 3.2 Add initial route loading and keyed in-page result skeletons with stable dimensions, `aria-busy`/status communication, one non-disruptive live region, and reduced-motion behavior
- [x] 3.3 Build the responsive available-room collection using the existing room-card visual language, complete configured comparison fields, explicit demonstration identification, optimized images, result count, and criteria-preserving primary actions
- [x] 3.4 Implement distinct and recoverable states for no availability, unavailable preselection, invalid/incomplete URL criteria, and unexpected failure with retry
- [x] 3.5 Verify the route at 320, 375, 768, 1024, and 1440 pixel widths, including keyboard order, visible focus, 44-pixel touch targets, contrast, no horizontal overflow, and no layout shift from async content

## 4. End-to-end acceptance and regression

- [x] 4.1 Replace the inline availability-list journey with an end-to-end journey from the hero search to the dedicated results page and onward to a room detail while preserving criteria
- [x] 4.2 Add end-to-end coverage for repeated searches, browser history, no results, invalid direct URLs, unavailable room preselection, loading semantics, and retryable errors
- [x] 4.3 Run unit, integration, end-to-end, accessibility, typecheck, lint, formatting, and production build checks, confirming that mock journeys make no requests to external hosts and that existing reservation flows remain operational
