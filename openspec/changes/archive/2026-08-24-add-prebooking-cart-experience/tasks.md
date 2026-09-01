## 1. Carro persistente y selección

- [x] 1.1 Replace the inline availability selection summary with a shared floating sticky reservation cart that derives its state from the existing URL selection and verify unit tests cover empty, single-room, and multi-room states.
- [x] 1.2 Implement responsive cart layouts, bottom safe-area spacing, keyboard-accessible actions, focus visibility, and live selection feedback; verify responsive and accessibility checks at phone and desktop widths.
- [x] 1.3 Implement an interruptible add-to-cart animation from availability cards and room detail using transform/opacity only, plus a reduced-motion alternative; verify the selection updates immediately and the reduced-motion journey has no travel animation.

## 2. Pre-reserva

- [x] 2.1 Create the public `/pre-reserva` route with recoverable empty and stale-selection states, preserving predictable navigation back to availability; verify route tests cover direct links and an empty cart.
- [x] 2.2 Compose the pre-reservation review with rooms, shared dates, nights, subtotals, aggregate total, removal controls, booking-holder fields, and conditional invoice-request fields; verify totals and invoice validation through component tests.
- [x] 2.3 Revalidate every selected room when dates change and before confirmation while continuing to use the existing authoritative reservation command; verify stale rooms block progression and no browser-supplied amount is trusted.

## 3. End-to-end verification

- [x] 3.1 Add Playwright coverage for adding from results and room detail, cart animation/fallback behavior, navigation to `/pre-reserva`, removal, invoice and non-invoice paths, and final confirmation totals.
- [x] 3.2 Run Node 22 unit, typecheck, lint, accessibility, responsive, and relevant end-to-end checks; verify reduced-motion and keyboard journeys do not obscure focus or content behind the sticky cart.

## 4. Corrección de fidelidad visual del carro

- [x] 4.1 Restyle the shared floating reservation cart to match the approved reference: warm rounded capsule, icon and quantity badge, three desktop zones with visible vertical separators, system-color hierarchy, soft elevation, and a dark rounded CTA; preserve the accessible responsive mobile reflow and existing cart behavior.
- [x] 4.2 Add or update focused visual/component coverage at desktop and mobile widths, then run the affected Node 22 test, typecheck, lint, accessibility, and responsive checks.

## 5. Continuidad de la reserva y refinamiento de experiencia

- [x] 5.1 Persist reservation dates and selected room identifiers across public navigation and browser reloads for the active session, synchronize the existing URL representation without storing personal data, clear the context after confirmation, and revalidate before continuing; verify returning to landing and adding another room preserves both selections.
- [x] 5.2 Gate the room-detail add action on a valid effective date range, rendering only the availability action when dates are absent and preserving prior selection when dates are present; add focused coverage for both entry states.
- [x] 5.3 Replace document-reloading selection transitions with client-side updates and add an interruptible transform/opacity cart entrance/update feedback that preserves scroll and honors reduced motion; verify no abrupt navigation occurs on add.
- [x] 5.4 Restyle the `/pre-reserva` background and surfaces to use the established semantic tokens, then add responsive/accessibility coverage and run affected Node 22 unit, typecheck, lint, and end-to-end checks.

## 6. Estados de selección y detalle expandible del carro

- [x] 6.1 Remove duplicate room-detail availability CTAs and implement explicit selected-room states that replace add with an added message and remove action, restoring context-appropriate actions after removal; cover no-date, dated, selected and removed states.
- [x] 6.2 Refine the add-to-cart travel animation to originate at the action's approximate button size, arrive at the cart center more gradually while scaling down, and preserve reduced-motion and client-side scroll behavior; add focused motion coverage.
- [x] 6.3 Implement an accessible expandable cart item summary that reveals an upward, content-height detail panel listing every selected room's name, nights and nightly rate; support outside-click, Escape and selection-change dismissal with reduced-motion behavior.
- [x] 6.4 Add responsive, keyboard and accessibility coverage for the selection states and expandable cart, then run affected Node 22 unit, typecheck, lint, Prettier and serial end-to-end checks.

## 7. Integración visual del detalle del carro

- [x] 7.1 Rework the expanded item detail so it is structurally part of the reservation-cart capsule, grows only upward by its natural content height, and keeps the identity, item summary and checkout zones vertically centered while expanded.
- [x] 7.2 Add a visible, accessible expansion affordance that reflects the compact and expanded states without color-only signaling; cover keyboard, outside-click, Escape, reduced-motion, and responsive alignment, then run affected checks.

## 8. Eliminación de habitaciones desde el carro

- [x] 8.1 Add an accessible, compact X remove action to every expanded-cart room row, updating URL/session selection, item count, subtotal, expansion state, and the empty-cart state without a document reload.
- [x] 8.2 Add focused unit and serial end-to-end coverage for removing one and the last room from the cart at desktop and mobile widths, including keyboard access, then run affected checks.

## 9. Fidelidad visual y fechas de pre-reserva

- [x] 9.1 Restyle `/pre-reserva` to the approved warm ivory reference using semantic tokens for page background, read-only date strip, and borderless `shadow-md` room and guest-data surfaces; introduce the approved `#F4E9DF` total-surface token and remove the update-date action and any date editing from this route.
- [x] 9.2 Add or update focused visual, responsive and accessibility coverage for the non-editable date summary and the new pre-reservation surfaces; run affected Node 22 checks and serial production end-to-end coverage.
