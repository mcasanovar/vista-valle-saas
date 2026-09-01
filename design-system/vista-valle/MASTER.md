# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/vista-valle/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Vista Valle
**Generated:** 2026-08-17 18:59:59
**Category:** Boutique lodging and direct booking
**Design Dials:** Variance 3/10 (Centered / Minimal) | Density 3/10 (Spacious)

> **Brand status:** This warm foundation is derived from the approved product brief.
> Revalidate exact brand colors and logo usage when the official logo assets arrive.

---

## Global Rules

### Color Palette

| Role             | Hex       | CSS Variable               |
| ---------------- | --------- | -------------------------- |
| Primary          | `#1C1917` | `--color-primary`          |
| On Primary       | `#FFFFFF` | `--color-on-primary`       |
| Secondary        | `#44403C` | `--color-secondary`        |
| On Secondary     | `#FFFFFF` | `--color-on-secondary`     |
| Accent/CTA       | `#A16207` | `--color-accent`           |
| On Accent/CTA    | `#FFFFFF` | `--color-on-accent`        |
| Background       | `#FAFAF9` | `--color-background`       |
| Foreground       | `#0C0A09` | `--color-foreground`       |
| Card             | `#FFFFFF` | `--color-card`             |
| Card Foreground  | `#0C0A09` | `--color-card-foreground`  |
| Muted            | `#F1EFEB` | `--color-muted`            |
| Muted Foreground | `#57534E` | `--color-muted-foreground` |
| Border           | `#D6D3D1` | `--color-border`           |
| Destructive      | `#DC2626` | `--color-destructive`      |
| On Destructive   | `#FFFFFF` | `--color-on-destructive`   |
| Ring             | `#1C1917` | `--color-ring`             |

**Color Notes:** Warm charcoal, cream, stone, and restrained earth-gold accent. Avoid saturated colors. Verified contrast ratios: on-accent/accent 4.92:1, foreground/background 18.92:1, muted-foreground/muted 6.64:1, and on-secondary/secondary 10.27:1.

### Typography

- **Heading Font:** Cormorant
- **Body Font:** Montserrat
- **Mood:** warm, elegant, calm, refined, welcoming, professional
- **Google Fonts:** [Cormorant + Montserrat](https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap)

**CSS Import:**

```css
@import url("https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap");
```

### Spacing Variables

_Density: 3/10 — Spacious_

| Token         | Value             | Usage                     |
| ------------- | ----------------- | ------------------------- |
| `--space-xs`  | `4px` / `0.25rem` | Tight gaps                |
| `--space-sm`  | `8px` / `0.5rem`  | Icon gaps, inline spacing |
| `--space-md`  | `24px` / `1.5rem` | Standard padding          |
| `--space-lg`  | `32px` / `2rem`   | Section padding           |
| `--space-xl`  | `48px` / `3rem`   | Large gaps                |
| `--space-2xl` | `64px` / `4rem`   | Section margins           |
| `--space-3xl` | `96px` / `6rem`   | Hero padding              |

### Shadow Depths

| Level         | Value                          | Usage                       |
| ------------- | ------------------------------ | --------------------------- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`   | Subtle lift                 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)`    | Cards, buttons              |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)`  | Modals, dropdowns           |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition:
    background-color 200ms ease,
    box-shadow 200ms ease,
    transform 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition:
    background-color 200ms ease,
    color 200ms ease,
    border-color 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: var(--color-card);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition:
    box-shadow 200ms ease,
    transform 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: var(--color-ring);
  outline: 3px solid var(--color-ring);
  outline-offset: 2px;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--color-card);
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Warm, clean, spacious, calm, high-contrast, photography-led, refined, functional

**Best For:** Boutique lodging discovery, direct booking, business accommodation, and a compact operations panel

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Hospitality Conversion Journey

- **Conversion Strategy:** Lead with real photography and availability, then build trust before the final booking decision.
- **CTA Placement:** Header + Hero + Room cards + Final CTA, with one primary action per section.
- **Section Order:** Header > Hero + availability search > Rooms > Why Vista Valle > Services > View/experience > Company accommodation > Location > Final booking CTA > Footer

---

## Anti-Patterns (Do NOT Use)

- ❌ Vibrant & Block-based
- ❌ Playful colors

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
