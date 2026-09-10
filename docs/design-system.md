# TwoPlayer design system

## Direction

The TwoPlayer visual foundation is dark, cinematic, atmospheric, premium, and tactical, with restrained sci-fi cues. Hierarchy comes from contrast, typography, spacing, and elevation—not from covering the interface in neon or blur.

The system is dark-first and token-driven. Components use semantic roles such as `bg-surface` and `text-muted-foreground`; they do not embed palette hex values. This keeps accessible contrast and future brand changes centralized in `src/app/globals.css`.

`/design-system` is the internal responsive showcase. It demonstrates primitives and interaction states only; it is not a lobby or functional game surface.

## Design principles

1. **Clarity before atmosphere.** Cinematic treatment must never obscure labels, status, focus, or error feedback.
2. **Controlled depth.** Use elevated surfaces, a quiet border, and occasional restrained glow. Glass blur is an accent, not the default for every layer.
3. **Semantic color.** Product meaning uses named roles; features do not pick arbitrary palette values.
4. **Tactical rhythm.** Compact technical labels can use mono/display treatments, while normal content stays highly readable.
5. **Input parity.** Keyboard, pointer, and touch users receive equivalent target sizes and feedback.
6. **Stable feedback.** Loading states preserve geometry and disabled states remain legible.
7. **Motion with purpose.** Micro-interactions confirm state changes in 150–300ms and collapse under reduced-motion preferences.

## Color tokens

### Foundations and text

| Semantic token        | Value               | Use                                            |
| --------------------- | ------------------- | ---------------------------------------------- |
| `background`          | `#070912`           | Page canvas; deepest navy-black.               |
| `background-subtle`   | `#0b0e1a`           | Quiet background separation and large regions. |
| `surface`             | `#111526`           | Standard cards and panels.                     |
| `surface-elevated`    | `#181d32`           | Dialogs and raised content.                    |
| `surface-interactive` | `#1c2239`           | Resting interactive/loading surface.           |
| `surface-hover`       | `#242b47`           | Neutral hover feedback.                        |
| `surface-pressed`     | `#2d3556`           | Neutral pressed feedback.                      |
| `foreground`          | `#f1f3ff`           | Main cool-light copy.                          |
| `foreground-strong`   | `#ffffff`           | Highest-emphasis text used sparingly.          |
| `muted`               | `#151a2b`           | Recessed region/fill.                          |
| `muted-foreground`    | `#aab1c7`           | Secondary copy that remains readable.          |
| `border`              | `#303750`           | Default subtle divider/border.                 |
| `border-strong`       | `#647096`           | Emphasized control boundary.                   |
| `overlay`             | `rgb(2 3 10 / 78%)` | Modal scrim.                                   |

### Brand and actions

| Role        | Rest      | Hover     | Pressed   | Subtle                  | Foreground |
| ----------- | --------- | --------- | --------- | ----------------------- | ---------- |
| Primary     | `#9b8cff` | `#afa4ff` | `#8372ee` | `#242047`               | `#0d091c`  |
| Secondary   | `#40365f` | `#4e4272` | `#352d50` | Uses contextual surface | `#f7f3ff`  |
| Accent/CTA  | `#f36c8c` | `#ff88a4` | `#d95676` | `#3a1927`               | `#210811`  |
| Destructive | `#f87171` | `#fb9090` | `#df5d5d` | `#3a171b`               | `#210809`  |

Primary indigo establishes product identity. Accent rose highlights a decisive CTA; it should not compete with every primary action. Destructive red is reserved for destructive or failure meaning, never ordinary emphasis.

### Status and focus

| Semantic token       | Value     | Use                          |
| -------------------- | --------- | ---------------------------- |
| `success`            | `#4ade80` | Positive state/icon.         |
| `success-subtle`     | `#122c20` | Success badge/panel fill.    |
| `success-foreground` | `#9cf7bb` | Success text on subtle fill. |
| `warning`            | `#fbbf24` | Caution state/icon.          |
| `warning-subtle`     | `#33270f` | Warning badge/panel fill.    |
| `warning-foreground` | `#ffda78` | Warning text on subtle fill. |
| `ring`               | `#c0b7ff` | Visible keyboard focus.      |

Status must never be communicated by color alone. Pair it with text, an icon, a shape, or a status-indicator label.

## Typography

Fonts load through `next/font/google`, which emits locally served application font assets instead of a render-blocking stylesheet import.

| Role/class               | Font stack                                           | Use                                                                   |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Sans / `font-sans`       | Geist, Vazirmatn, Segoe UI, sans-serif               | Body copy, controls, and long-form content.                           |
| Display / `font-display` | Orbitron, Geist, Vazirmatn, Segoe UI, sans-serif     | Short headings, game/HUD-inspired labels, and major section identity. |
| Mono / `font-mono`       | Geist Mono, Cascadia Code, SFMono-Regular, monospace | Codes, numeric/technical values, timestamps, and compact metadata.    |
| Persian / `font-persian` | Vazirmatn, Tahoma, Arial, sans-serif                 | Persian and Arabic-script content.                                    |

Guidelines:

- Keep Orbitron to short display strings; its geometric letterforms reduce readability in paragraphs.
- Use normal sentence casing for actions and content. Uppercase plus wider tracking is appropriate only for short tactical/technical labels.
- Use tabular numerals where changing statistics must not shift horizontally.
- `:lang(fa)` and `[dir="rtl"]` switch to the Persian-capable stack. Set the correct `lang` and `dir` at the nearest meaningful document/container boundary.
- Do not fake Persian support by leaving Latin display fonts first in the fallback order.
- Preserve a readable body line height (approximately 1.5; longer copy may use 1.6–1.75).

Complete localization and RTL flow testing are deferred, but every new component should avoid physical left/right assumptions when logical CSS properties are available.

## Spacing and layout

The Tailwind base spacing unit is `0.25rem` (4px). Prefer an 8px rhythm for normal layout while retaining 4px increments for fine alignment.

| Need                        | Preferred spacing                              |
| --------------------------- | ---------------------------------------------- |
| Icon to label               | 8px                                            |
| Closely related text        | 4–8px                                          |
| Controls in a compact group | 8–12px                                         |
| Card internal spacing       | 16–24px                                        |
| Section spacing             | 24–48px                                        |
| Page gutters                | 16px small screens; 24–32px when space permits |

Avoid arbitrary values unless a measured asset or interaction demands one. Loading placeholders should use the final content dimensions whenever possible.

### Breakpoints

| Token | Width            | Intent                                 |
| ----- | ---------------- | -------------------------------------- |
| `sm`  | 640px / `40rem`  | Larger phones and compact panels.      |
| `md`  | 768px / `48rem`  | Tablets and two-column opportunities.  |
| `lg`  | 1024px / `64rem` | Desktop navigation/content structures. |
| `xl`  | 1280px / `80rem` | Wide desktop composition.              |
| `2xl` | 1440px / `90rem` | Maximum showcase/content refinement.   |

Design mobile-first. The Phase 1 visual QA targets are 375px, 768px, 1024px, and 1440px. Never require horizontal scrolling for ordinary page content.

## Shape, depth, and glass

### Radius

| Token       | Value | Typical use                               |
| ----------- | ----- | ----------------------------------------- |
| `radius-sm` | 6px   | Small internal elements.                  |
| `radius-md` | 10px  | Buttons and form controls.                |
| `radius-lg` | 14px  | Cards and panels.                         |
| `radius-xl` | 20px  | Large feature surfaces/dialog treatments. |

### Elevation

- `shadow-card` creates restrained separation without a bright halo.
- `shadow-dialog` gives modal content enough depth above the overlay.
- `shadow-glow` combines a faint primary outline and diffuse purple depth; reserve it for priority/identity.

Standard cards use a near-opaque surface with a small backdrop blur. Elevated cards/dialogs may use the stronger elevated surface and blur. Text contrast must be evaluated against the actual composited background; glass should be disabled or made opaque when imagery would compromise it.

## Motion

| Token           | Duration | Use                                                       |
| --------------- | -------- | --------------------------------------------------------- |
| `motion-fast`   | 150ms    | Tooltip, focus-adjacent, and exit feedback.               |
| `motion-normal` | 220ms    | Standard portal/dialog entrance and composed transitions. |
| `motion-slow`   | 300ms    | Larger but still brief transitions.                       |

The standard easing is `cubic-bezier(0.2, 0.8, 0.2, 1)`; exit easing is `cubic-bezier(0.4, 0, 1, 1)`.

Core controls currently use Tailwind's 150ms or 200ms duration utilities, while the custom dialog animation uses the 220ms token. Both follow the 150–300ms micro-interaction window; use the named tokens when authoring custom CSS.

Motion rules:

- Animate opacity and transforms where possible; avoid layout-triggering properties.
- Pressed controls may translate by 1px, but their layout box must remain fixed.
- Loading spinners are decorative beside an announced status.
- Do not loop decorative atmospheric animation indefinitely by default.
- Under `prefers-reduced-motion: reduce`, or when an authenticated user enables the saved reduced-motion preference, animation/transition durations collapse to near-zero and smooth scrolling is disabled.

## Layering

| Token       | Value | Owner                   |
| ----------- | ----- | ----------------------- |
| `z-tooltip` | 60    | Tooltip portal content. |
| `z-overlay` | 80    | Dialog scrim.           |
| `z-dialog`  | 90    | Dialog content.         |

The keyboard skip link uses `z-index: 100` so it remains reachable above overlays during navigation. Feature code should not invent larger z-index values without extending this scale.

## Component catalog

All primitives are exported from `src/components/ui`. They forward refs where appropriate, accept `className` for intentional composition, and use the shared `cn` utility for predictable class merging.

### Button

- Variants: `primary`, `secondary`, `accent`, `outline`, `ghost`, and `destructive`.
- Sizes: `sm` (44px), `md` (48px), and `lg` (56px).
- `loading` disables activation, sets `aria-busy`, shows a Lucide loader plus status text, and keeps the original content in the same grid cell to preserve width.
- `loadingText` provides contextual announced copy; default is “Loading”.
- Default `type` is `button` to avoid accidental form submission.

Use one dominant primary or accent action per local decision group. Do not make a non-destructive cancellation action red.

### IconButton

- Requires a `label`; the implementation maps it to `aria-label` because an icon alone has no accessible name.
- Sizes are 44px, 48px, and 56px.
- Supports ghost, outline, secondary, accent, destructive, disabled, and loading treatments.
- Loading updates the accessible label and disables activation.

Do not pass emoji or text glyphs as interface icons. Use an icon from Lucide and mark decorative SVGs hidden from assistive technology.

### Card

- Variants: default, elevated, and subtle.
- Padding options: none, small, medium, and responsive large.
- Composable regions: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`.
- Cards are structural surfaces, not interactive controls. If the entire surface becomes actionable later, use a real link/button and define its focus/pressed behavior.

### Badge

- Variants: neutral, primary, accent, success, warning, destructive, and outline.
- Sizes: small and medium.
- Badges are labels/status summaries, not buttons. Use a button for a dismissible or selectable chip.

### Input and Select

- Provide a visible label, optional description, and stable error region.
- Invalid controls use both semantic invalid attributes and destructive feedback.
- Keep a minimum 44px target, visible focus ring, disabled treatment, and sufficient placeholder contrast.
- The select uses accessible headless behavior and Lucide indicators rather than native text glyphs.

### Dialog

- Built on Radix Dialog for focus containment, keyboard dismissal, accessible title/description relationships, and portal behavior.
- Use a labeled trigger, `DialogTitle`, optional `DialogDescription`, body content, and explicit close/action controls.
- Scrim and content entrances use the shared motion tokens and reduced-motion override.
- Dialogs are for bounded decisions. Do not use one as primary page navigation or hide long workflows in it.

### Tabs

- Built on Radix Tabs with keyboard navigation and explicit active/inactive states.
- Tab labels must remain meaningful without relying on their visual position.
- Preserve content height where rapid switching would create distracting layout jumps.

### Avatar

- Composes Radix `Avatar`, `AvatarImage`, and `AvatarFallback`; the consumer supplies the fallback initials/content rather than the primitive deriving them.
- Sizes are 36px, 44px, 56px, and 80px. A 36px decorative avatar is allowed, but an actionable avatar still needs a surrounding target of at least 44px.
- The consumer supplies meaningful alternate/name context and a deterministic fallback policy at the feature boundary.

### StatusIndicator

- Combines a visible status dot/treatment with text or an accessible label.
- Visual states are `online`, `away`, `busy`, and `offline`; the primitive supplies a default readable label and also supports a custom label.
- Status semantics cover foundation UI only; they do not implement or poll live presence.
- “Online” examples in the showcase are visual demonstrations, not presence behavior.

### Skeleton

- Radius options: small, medium, large, and full.
- Decorative skeletons are hidden from assistive technology; a labeled skeleton may act as a status.
- Set an explicit width/height matching expected content to prevent layout shift.
- Pulse animation stops under reduced-motion preferences.

### EmptyState and ErrorState

- Provide a concise heading, useful description, and optional action.
- Default to an `h3` inside composed sections and use `titleAs` to preserve the correct heading level on standalone pages.
- Empty state explains an absence without treating it as failure.
- Error state uses safe, actionable language and never renders raw stack traces, provider messages, or secrets.
- Retry actions use a real button and stay available to keyboard users.

### Divider

- Supports horizontal, vertical, and labeled horizontal separators.
- Uses separator semantics and `aria-orientation`.
- Labels use the restrained mono/uppercase technical treatment.

### Tooltip

- Built on Radix Tooltip for accessible trigger/content relationships and portal positioning.
- Tooltips clarify an already discoverable control; they never contain essential-only information or interactive workflows.
- Icon-only controls still require an accessible label even if a tooltip is present.

## Interaction-state contract

Interactive components must account for all relevant states:

| State          | Required signal                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Rest           | Clear affordance and readable label.                                                                              |
| Hover          | Subtle surface/border/color change; never the only way to discover a control.                                     |
| Focus visible  | Two-pixel `ring` with offset against `background`; no removal without an equivalent.                              |
| Pressed/active | Color shift and optional 1px translation within a stable box.                                                     |
| Disabled       | Native disabled semantics where available, no pointer activation, reduced opacity, and retained readable context. |
| Loading        | Disabled activation, announced busy/status state, visible progress, and stable dimensions.                        |
| Invalid        | Programmatic invalid state plus linked error text; not red border alone.                                          |

The base interactive target is at least 44×44px (`min-h-11` / `min-w-11`). Inline text links may be exceptions when they are not primary touch controls, but they still need visible focus and adequate spacing.

## Accessibility checklist

Before accepting a new or composed component:

- Use the native element that represents the action (`button`, `a`, `input`, etc.).
- Give every control an accessible name; associate form labels and errors programmatically.
- Confirm complete keyboard operation, logical tab order, Escape/arrow behavior where expected, and focus restoration after overlays.
- Do not use color, position, hover, sound, or animation as the only carrier of meaning.
- Verify WCAG AA contrast for normal text, large text, control boundaries, icons that convey meaning, and focus indicators.
- Keep targets approximately 44px and avoid tightly packed destructive actions.
- Retain content structure at 200% zoom and narrow viewports without horizontal page overflow.
- Reserve geometry during loading and prevent unexpected focus/scroll jumps.
- Respect `prefers-reduced-motion` and avoid flashes or rapid continuous animation.
- Use `lang="fa"` and `dir="rtl"` for Persian samples; inspect icon direction, truncation, numbers, and mixed-script text.
- Test dialogs, tabs, selects, tooltips, and error feedback with a screen reader—not only automated checks.

Contrast was selected for the dark token combinations, but any opacity, backdrop, image, gradient, or new pairing changes the rendered contrast and must be retested.

## Composition rules for later phases

- Import primitives from the UI barrel instead of deep-copying their styles.
- Keep feature-specific layout and copy in feature components; keep reusable interaction mechanics in primitives.
- Add a semantic token when a recurring product role is missing. Do not encode a new brand color in one component.
- Extend variants only when the semantic choice recurs in multiple contexts.
- Never wire room, presence, matchmaking, or gameplay business logic into these primitives.
- Treat server errors as data passed into `ErrorState`; do not make the component call APIs itself.
- Keep provider-specific connection state outside presentational primitives and translate it to platform status vocabulary.

## Review matrix

Minimum manual review for Phase 1 and later UI changes:

| Dimension | Cases                                                         |
| --------- | ------------------------------------------------------------- |
| Viewport  | 375px, 768px, 1024px, 1440px                                  |
| Input     | Keyboard only, mouse/trackpad, touch-sized targets            |
| State     | Rest, hover, focus, pressed, disabled, loading, invalid/error |
| Motion    | Normal and reduced motion                                     |
| Content   | Short, long, missing, and loading text                        |
| Language  | English plus a Persian/RTL sample                             |
| Zoom      | 200% browser zoom and reflow                                  |

## Phase 2 product compositions

- `AppShell` uses the same surface, border, focus, type, and z-index tokens for the sticky header, account-aware navigation, mobile menu, and footer. Session loading reserves navigation geometry.
- `GameArt`, `GameCard`, and `CatalogGrid` keep a stable 16:9 art region, textual status, capacity/duration metadata, a single card link, and local token-driven fallback art.
- `AuthForm`, `GuestForm`, `ProfileForm`, and `SettingsForm` reuse labeled inputs, buttons, selects, cards, inline errors, `aria-live` success feedback, and stable pending states.
- Route-specific skeletons mirror the final card/page proportions. Empty and failure surfaces always explain recovery and link to a known destination.
- Feature copy distinguishes a browsable “available preview” from future multiplayer availability. Status is never implied by glow or color alone.

These compositions add no new raw palette values or icon family. Their responsive review targets remain 375px, 768px, 1024px, and 1440px, including zoom and reduced-motion checks.

The design system and Phase 2 compositions contain no working room creation, room joining, presence, matchmaking, chat, voice, or game controls.
