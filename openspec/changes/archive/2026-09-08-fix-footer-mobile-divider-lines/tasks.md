## 1. Fix

- [x] 1.1 In `src/presentation/organisms/public-static.tsx` (`PublicFooter`), constrain the three divider `<div className="absolute top-0 left-1/4|2/4|3/4 h-full w-px bg-on-primary/20" />` elements (lines ~176, ~192, ~208) to only render at the same breakpoint where the grid becomes multi-column (`tablet:` and up, matching the existing `tablet:grid-cols-4` on the parent), e.g. by adding `hidden tablet:block`. Verify by reading the updated JSX: each divider div's class list includes `hidden` plus a `tablet:block` (or equivalent) counterpart.

## 2. Verify

- [x] 2.1 Run the project's existing lint/typecheck/test commands (per `package.json`) and confirm they pass with no new failures. (lint ✓, typecheck ✓; 2 pre-existing unrelated test failures in `prebooking-review-controller.test.tsx` and `room-detail.test.tsx` confirmed present without this change too, via `git stash`.)
- [x] 2.2 Using Chrome browser automation, load the affected page at a mobile viewport (390x844) and confirm the footer shows no vertical divider lines through the stacked "Navegación" / "Contacto" / "WhatsApp" content. (Verified on `localhost:3000/habitaciones` at 390 width, zoomed screenshot: no divider lines.)
- [x] 2.3 Using Chrome browser automation, load the same page at a desktop viewport (1440x900) and confirm the three divider lines still render correctly between the four columns (no regression). (Verified on `localhost:3000/habitaciones` at 1440x900: dividers render correctly between all 4 columns.)
