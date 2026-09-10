# Solo mode, locales, and navigation

## Solo Nightfall Protocol

Open **Games → Nightfall Protocol → Rooms**, choose **Play Solo**, and create a room. The host marks Ready and starts immediately; no second browser or AI participant is created. The room stores `mode=solo`, the reservation contains one participant, and the game server validates mode, readiness, lifecycle, reconnect grace, waves, economy, and outcomes. Solo downed players bleed out and are defeated if they do not reach the next intermission; teammate revive commands are unavailable in solo mode. Co-op rooms continue to require two connected ready players.

Migration `20260909030000_solo_mode` adds the `GameMode` enum and defaults existing rooms to `COOP`. Apply it with the normal Prisma migration deployment process.

## English and Persian

`src/i18n/messages.ts` is the typed translation catalog. `getRequestLocale()` resolves explicit selection, authenticated `User.locale`, the `twoplayer_locale` cookie, then English. Settings persist authenticated selections in `User.locale` and the cookie; the header switcher persists guest choices in the cookie and calls `router.refresh()` so the shared App Router shell updates without a document reload.

The root layout sets `lang` and `dir` during server rendering (`en/ltr` or `fa/rtl`) and applies `data-locale`. Persian uses the checked-in Vazir weights through `next/font/local`; no external Persian font request is made. The gameplay HUD inherits the same local font variable.

## Navigation measurement

Route transitions use App Router links and loading boundaries. `src/components/navigation/route-progress.tsx` records `route:<pathname>:ready` performance marks and exposes pending feedback. Reproduce measurements with Chrome DevTools Performance or Playwright by recording navigation entries and route marks while traversing Home → Games → Rooms → Prepare. The verified webpack production build completed in about 46 seconds on the local Windows workstation after clearing generated caches; route wall-clock before/after numbers require a target Vercel region and are therefore intentionally not fabricated. Route loading skeletons are visible immediately on dynamic room and gameplay routes.

Known limitations: the catalog and legacy gameplay copy still contain English strings while the typed catalog is expanded incrementally; the current game server's final boss interaction remains the existing Phase 6 implementation. No secrets or server-only environment variables are exposed by the locale or mode changes.
