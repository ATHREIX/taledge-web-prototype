# Taledge Design System

Single source of truth for product UI. **Every page must use these primitives.**
No per-role colors, no inline card/button styles, no hardcoded hex.

## Brand & color

- **One brand**: `brand-*` = indigo (`brand-600` is the primary action color).
- **Accent**: `accent-*` = sky, used ONLY in the `brand -> accent` gradient.
- **Canvas**: every page background is `bg-canvas` (`#F8FAFC`). Never use
  `bg-[#FAFAFA]`, `bg-slate-50`, `bg-[#F8FAFC]`, or per-role bg colors.
- **Neutrals**: `ink-*` (50–950). Text = `text-ink-900/700/500`.
- **Semantic only**: success=`emerald`, warn=`amber`, danger=`rose`. Do not use
  violet / fuchsia / purple / teal anywhere — they were the old per-role colors.
- Hero gradient text: class `text-gradient-brand`.

## Components (`@/components/ui`)

```tsx
import { PageShell, PageHeader, Card, Button, ButtonLink, Badge,
         Display, Heading, Eyebrow, Label } from "@/components/ui";
```

- `<PageShell width="default|wide|narrow">` — page scaffold (canvas, grid, glow,
  max-width, padding). Wrap every page body in it.
- `<PageHeader eyebrow title description actions />` — standard page title block.
- `<Card variant="default|frosted|flat" hover>` + `CardHeader` / `CardBody`.
- `<Button variant="primary|ghost|soft|danger|link" size="sm|md|lg">` and
  `<ButtonLink href ...>` (same look, renders a Next `Link`).
- `<Badge tone="neutral|brand|success|warn|danger|dark">`.
- Typography: `<Display>` (hero h1), `<Heading as>` (section h2/h3),
  `<Eyebrow>` (uppercase kicker), `<Label>`.

## Motion (`@/lib/motion`)

Import `containerVariants`, `itemVariants`, `fadeVariants`, `EASE`, `transition`.
Do NOT redefine motion variants inline. The `motion.tsx` helpers
(`FadeIn`, `SlideUp`, `StaggerContainer`, `StaggerItem`, `HoverCard`) still work.

## Utilities

- `cn(...)` from `@/lib/utils` to compose conditional classes.
- Radii: cards = `rounded-xl2` (1rem), panels/surfaces = `rounded-xl3` (1.5rem),
  pills/badges = `rounded-full`. Don't mix `rounded-2xl/3xl` arbitrarily.
- Elevation: `shadow-panel` / `shadow-panel-hover`. No one-off `shadow-[...]`.
- Frosted surface: class `panel`.

## Fonts

- Sans = Inter (`font-sans`, default) — body, UI, headlines via `.h-headline`.
- Display serif = Source Serif (`font-display`) — optional editorial headers.
- Mono = JetBrains (`font-mono`) — code/editor only.

## Migration rules

1. Replace page root with `<PageShell>`.
2. Replace inline cards with `<Card>`; inline buttons with `<Button>/<ButtonLink>`.
3. Replace chips with `<Badge>`.
4. Swap every `indigo/violet/fuchsia/purple/teal/sky` accent to `brand` (gradients
   to `text-gradient-brand` or `from-brand-600 to-accent-500`).
5. Swap page bg to `bg-canvas` (handled by PageShell).
6. Headlines via `<Display>/<Heading>` or `.h-headline`.
7. Remove duplicated local motion variant objects; import from `@/lib/motion`.
8. Keep all data, props, and behavior identical — this is a visual/structural
   refactor only.
