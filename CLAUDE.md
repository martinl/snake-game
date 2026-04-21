# Snake Game

Nokia-style Snake as an installable PWA with a global Supabase leaderboard. Static hosting on GitHub Pages, €0/month target. Full design in [ARCHITECTURE.md](ARCHITECTURE.md) — read that first when reasoning about the system; this file only captures what's useful at the keyboard.

## Status

**M1–M2 landed (2026-04-21):** playable Snake in browser with keyboard + swipe controls, responsive LCD panel, iOS viewport quirks handled (`dvh`, `safe-area-inset-*`, `apple-mobile-web-app-*` meta tags), local hi-score in `localStorage`. No PWA or backend yet — those are M3–M7 ([ARCHITECTURE.md:388](ARCHITECTURE.md#L388)). Node toolchain is via `nvm` (Node 24.15 installed); source nvm before running scripts: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.

## Stack

- **Client:** TypeScript + Vite + HTML5 Canvas 2D, vanilla CSS, `vite-plugin-pwa` (Workbox).
- **Backend:** Supabase free tier — Postgres + PostgREST auto-API + one RPC (`submit_score`). Anonymous access, security via RLS.
- **CI/Hosting:** GitHub Actions → `gh-pages` branch → GitHub Pages. Keep-warm cron every 6h to avoid the 7-day Supabase pause ([ARCHITECTURE.md:74-92](ARCHITECTURE.md#L74-L92)).

## Layout (current; see [ARCHITECTURE.md:96-121](ARCHITECTURE.md#L96-L121) for the full plan)

```
src/
  main.ts              # wiring
  game/
    state.ts           # types, constants, initial state, food spawn
    rules.ts           # tick(), bufferDirection()
    engine.ts          # rAF loop, fixed-timestep sim
    renderer.ts        # canvas draw
  input/
    keyboard.ts        # arrow keys + WASD + space/enter
    touch.ts           # swipe gestures (20px threshold), tap-to-start
  ui/
    hud.ts             # score, hi-score, overlay
  styles.css
# not yet created: ui/menu.ts, ui/nameEntry.ts, net/*, pwa/*, supabase/
.github/workflows/deploy.yml  # Pages deploy (push to main) + Trivy + build-check (PR)
```

### M1 constants (locked)

- Grid 24×18, canvas 480×360 (20px cells).
- Tick starts at 160ms, floor 60ms, multiplied by 0.96 per food eaten.
- Wall collision = game over. No wrap.
- Local hi-score key: `snake.hiscore.v1`.
- Swipe threshold: 20px. A single swipe can register multiple direction changes (origin resets after each fire).

## Conventions worth keeping straight

- **Fixed-timestep sim, `requestAnimationFrame` render.** Don't couple them. Interpolate between ticks for smooth motion on 120Hz displays.
- **Input buffering.** Queue the *next* direction change — don't apply immediately. Reject 180° reversals. This is the classic Snake feel, not a bug ([ARCHITECTURE.md:133-136](ARCHITECTURE.md#L133-L136)).
- **Writes go through the `submit_score` RPC, never direct `INSERT`.** RLS has no insert policy — direct inserts are blocked by design. Server-side sanity check lives in the RPC ([ARCHITECTURE.md:200-238](ARCHITECTURE.md#L200-L238)).
- **The Supabase anon key ships in the bundle.** That's expected — security comes from RLS, not key secrecy. Don't treat it as a secret leak.
- **Offline-first.** Service worker caches the app shell; game is fully playable offline. Scores queued in IndexedDB, flushed on reconnect. Don't add features that hard-require network during gameplay.
- **Treat `localStorage` as ephemeral on iOS.** Sync to server; don't rely on local state surviving.
- **Untrusted input discipline.** Anything from the user, the network, storage, or the URL is untrusted. Validate at the boundary (`submit_score` RPC server-side; input handlers client-side); never `innerHTML` a name. SQL stays parameterized — no string-built `EXECUTE` in plpgsql. Full rules in [ARCHITECTURE.md §7a](ARCHITECTURE.md#7a-security-requirements).
- **CI security gate.** PRs run Trivy (`fs` mode, `vuln,secret,misconfig` scanners). HIGH/CRITICAL block the PR; MEDIUM/below report only. Suppressions go in `.trivyignore` with a dated reason.

## Open decisions (don't invent answers — ask)

Resolved: visual style, grid size, speed curve, wall behavior (see [ARCHITECTURE.md §13](ARCHITECTURE.md#L403-L412)). Still open: name-entry format (M5/M6) and leaderboard splits (M5). If a task depends on one of these, surface the question rather than picking silently.

## Explicit non-goals

Multiplayer, accounts with email/password, App/Play Store builds, cosmetic skins, ads/analytics, anti-cheat beyond basic sanity checks. See [ARCHITECTURE.md:376-383](ARCHITECTURE.md#L376-L383) before proposing scope that touches these.

## Commands

- `npm run dev` — Vite dev server on `http://localhost:5173`
- `npm run build` — production bundle into `dist/`
- `npm run preview` — serve built bundle locally
- `npm run typecheck` — `tsc --noEmit`
- Supabase migrations will live in `supabase/migrations/` and are applied via the Supabase CLI (not yet created).
