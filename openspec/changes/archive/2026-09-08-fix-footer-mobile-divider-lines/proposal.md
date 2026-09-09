## Why

The production footer (verified on www.vistavallehospedaje.com at 390x844) shows the vertical divider lines from the desktop 4-column grid ("Navegación" / "Contacto" / "WhatsApp" / logo) still rendering on mobile, where the columns stack into a single column. The lines run down through the stacked text instead of disappearing, making the footer look broken on phones — the majority of visitor traffic for a hospedaje site.

## What Changes

- Remove or hide the footer's inter-column divider lines at mobile breakpoints, so they only render when the columns are actually laid out side by side (desktop/tablet grid).
- No content, links, copy, or desktop layout changes — purely a responsive CSS fix scoped to the footer component.

## Capabilities

No new or modified capabilities: this is a visual CSS defect fix with no change to any spec-level requirement (footer content/links/behavior are unchanged and undocumented in any existing spec). `skip_specs: true` is set in `.openspec.yaml`.

### New Capabilities

(none)

### Modified Capabilities

(none)

## Impact

- Affected code: the shared footer component/styles used across the public landing (likely under `app/` or `src/components` — to be located during implementation) and its Tailwind/CSS responsive classes.
- No API, database, or dependency changes.
- No effect on other breakpoints' visual output (desktop/tablet keep the dividers).
