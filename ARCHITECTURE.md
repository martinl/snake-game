# Snake Game — Architecture Document

**Target:** Nokia-style Snake playable in browser + installable as PWA on iOS/iPadOS/Android.
**Backend:** Supabase (free tier) for global leaderboard.
**Hosting:** GitHub Pages (web) + GitHub Releases (any downloadable assets).
**Cost:** €0/month at expected usage.

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         Player                                │
│           (Desktop browser / iOS Safari / Android Chrome)     │
└────────────────┬─────────────────────────────────┬───────────┘
                 │                                 │
         HTTPS (static assets)           HTTPS (leaderboard API)
                 │                                 │
                 ▼                                 ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│      GitHub Pages         │        │        Supabase           │
│   (static hosting, CDN)   │        │  (Postgres + PostgREST +  │
│                           │        │   Edge Functions)         │
│  ┌─────────────────────┐  │        │                           │
│  │ index.html          │  │        │  ┌─────────────────────┐  │
│  │ game.js (Canvas)    │  │        │  │ scores (table)      │  │
│  │ leaderboard.js      │──┼────────┼─▶│ submit_score (RPC)  │  │
│  │ sw.js (service wkr) │  │        │  │ top_scores (view)   │  │
│  │ manifest.json       │  │        │  └─────────────────────┘  │
│  │ icons/              │  │        └──────────────────────────┘
│  └─────────────────────┘  │
└──────────────────────────┘
```

The client is a Progressive Web App — a single-page app that installs to the home screen on iOS/Android, works offline (except leaderboard), and ships as a static bundle.

No native code. No app stores. No build server. Push to `main`, GitHub Pages deploys, done.

---

## 2. Technology Stack

### Client

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Catch bugs at build time; your toolchain comfort |
| Build | Vite | Fast dev server, single-command production build, native TS |
| Rendering | HTML5 Canvas 2D | Snake is a grid — no need for WebGL or a game engine |
| State | Plain JS objects | Snake state is ~6 fields; Redux/etc. would be overkill |
| PWA | Workbox (via `vite-plugin-pwa`) | Service worker generation, offline cache, install prompt |
| Styling | Vanilla CSS | Monochrome UI; no framework needed |

### Backend

| Layer | Choice | Why |
|---|---|---|
| Platform | Supabase (free tier) | Postgres + auto REST + auth + Edge Functions bundled |
| DB | Postgres (managed) | RLS for security, views for top-N queries |
| API | PostgREST (auto) + 1 RPC | Auto-generated from schema; RPC for validated score submission |
| Auth | Anonymous/device-based | No login UX for a Snake game; submit with a display name |

### Dev / CI

| Layer | Choice | Why |
|---|---|---|
| Repo | GitHub, public | Free Pages hosting requires public repo (or Pro) |
| CI | GitHub Actions | `vite build` → publish `dist/` to `gh-pages` branch |
| Secrets | Actions secrets | Supabase anon key injected at build time |

---

## 3. Supabase Free-Tier Constraints (and how we handle them)

Relevant limits for this project:

| Limit | Value | Our usage |
|---|---|---|
| Database size | 500 MB | ~1 KB per score row → 500,000 scores fits fine |
| Egress | 5 GB/month | Leaderboard page ~2 KB gzipped → 2.5M loads/month |
| API requests | Unlimited | No concern |
| MAU | 50K | We don't authenticate users (anonymous submit) |
| Edge function invocations | 500K/month | Only used for anti-cheat validation |
| **Project pauses after 7 days of inactivity** | ⚠️ | Mitigation below |

### Handling the 7-day pause

If nobody plays for a week, the project pauses. The next request auto-resumes it but hits a cold start (~30 seconds). Two mitigations:

1. **Client-side graceful degradation** — if the leaderboard fetch times out, show cached top 10 from `localStorage` and retry in the background.
2. **Scheduled ping** — a GitHub Actions cron job (`schedule: '0 */6 * * *'`) hits the leaderboard endpoint every 6 hours. This is free and keeps the project warm. Runs as a simple `curl` step.

---

## 4. Client Architecture

### Module layout

```
src/
├── main.ts              # Bootstrap, wire up modules
├── game/
│   ├── engine.ts        # Game loop (requestAnimationFrame)
│   ├── state.ts         # Snake, food, score, direction
│   ├── rules.ts         # Movement, collision, growth
│   └── renderer.ts      # Canvas draw calls
├── input/
│   ├── keyboard.ts      # Arrow keys, WASD
│   └── touch.ts         # Swipe + optional on-screen D-pad
├── ui/
│   ├── hud.ts           # Score display, game-over screen
│   ├── menu.ts          # Start, options, leaderboard view
│   └── nameEntry.ts     # 3-char classic entry or free text
├── net/
│   ├── supabase.ts      # Thin wrapper around supabase-js
│   └── leaderboard.ts   # submit, fetch top-N, cache
├── pwa/
│   └── register.ts      # Service worker registration
└── styles.css
```

### Game loop

Fixed-timestep simulation, decoupled from render. Snake moves on a tick (e.g. 120ms at slowest speed, 60ms at fastest). Rendering happens every frame via `requestAnimationFrame` and interpolates between ticks for smooth motion on high-refresh displays.

### Input handling

- **Desktop:** arrow keys / WASD
- **Mobile:** swipe gestures via `touchstart` / `touchmove` with a threshold of ~20px. Reject 180° reversals (no instant suicide).
- **Optional D-pad:** on-screen buttons shown when touch is detected, toggleable in settings.

### Controls: input-buffering rule

Buffer the *next* direction change rather than applying it immediately. Prevents double-input-per-tick from killing the player when they try to turn a corner (e.g. right + up within 30ms on a 120ms tick). This is the classic Snake feel.

### Offline behavior

Service worker caches the app shell (HTML/JS/CSS/icons). The game is fully playable offline. Scores achieved offline are queued in `IndexedDB` and submitted on next network availability.

---

## 5. Data Model

### `scores` table

```sql
create table scores (
  id           bigserial primary key,
  display_name text         not null check (length(display_name) between 1 and 16),
  score        int          not null check (score >= 0 and score <= 10000),
  game_seconds int          not null check (game_seconds > 0),
  grid_size    int          not null,
  speed_preset text         not null check (speed_preset in ('slow','normal','fast')),
  client_hash  text         not null,
  country      text,              -- optional, from CF-IPCountry if proxied
  created_at   timestamptz  not null default now()
);

create index scores_top on scores (speed_preset, score desc, created_at asc);
create index scores_recent on scores (created_at desc);
```

### Views

```sql
create view top_scores_all_time as
  select display_name, score, speed_preset, country, created_at
  from scores
  order by score desc, created_at asc
  limit 100;

create view top_scores_daily as
  select display_name, score, speed_preset, country, created_at
  from scores
  where created_at > now() - interval '24 hours'
  order by score desc, created_at asc
  limit 100;
```

### Row Level Security

```sql
alter table scores enable row level security;

-- anyone can read
create policy "public read" on scores
  for select using (true);

-- nobody can write directly; writes go through RPC only
-- (no INSERT policy = blocked by default under RLS)
```

---

## 6. Score Submission Flow

Client calls a Postgres function (RPC), not an `INSERT`. This lets us do server-side validation.

```sql
create or replace function submit_score(
  p_name text,
  p_score int,
  p_seconds int,
  p_grid int,
  p_speed text,
  p_hash text
) returns bigint
language plpgsql
security definer
as $$
declare
  v_id bigint;
  v_min_seconds_per_point numeric := 0.15;  -- fastest plausible rate
begin
  -- sanity: is the score even plausibly achievable in this time?
  if p_seconds < (p_score * v_min_seconds_per_point) then
    raise exception 'impossible score/time ratio';
  end if;

  -- simple name sanitation
  if p_name !~ '^[A-Za-z0-9_\- ]{1,16}$' then
    raise exception 'invalid name';
  end if;

  -- rate limit per IP via pg_stat (or use an auth.uid() if anonymous auth enabled)
  -- (left as TODO — implement via Edge Function if abuse appears)

  insert into scores (display_name, score, game_seconds, grid_size, speed_preset, client_hash)
  values (p_name, p_score, p_seconds, p_grid, p_speed, p_hash)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function submit_score to anon;
```

### Client call

```ts
const { data, error } = await supabase.rpc('submit_score', {
  p_name:    displayName,
  p_score:   score,
  p_seconds: Math.round(elapsedMs / 1000),
  p_grid:    GRID_SIZE,
  p_speed:   speedPreset,
  p_hash:    computeClientHash(gameEvents),
});
```

---

## 7. Anti-Cheat Strategy

This is a public free leaderboard for a casual game. **Perfect** anti-cheat is impossible against a determined attacker without server-side simulation, which is out of scope. Goal: raise the effort bar enough that casual cheating isn't worth it.

Layered defenses, cheapest first:

1. **Server-side score/time sanity check** (in the RPC above). Blocks trivial "score=9999, time=3s" submissions.
2. **Plausible-range caps** (`score <= 10000`, `length(name) <= 16`). Blocks integer-overflow and name-spam griefing.
3. **Client hash of game events.** Each direction change and food eaten is fed into a rolling hash. Server can't verify it's correct (no re-simulation), but it means a cheater has to actually modify the game, not just `POST` raw JSON.
4. **Rate limiting per IP** — implemented in an Edge Function if abuse appears. Deferred until needed.
5. **Separate "verified" leaderboard (future)** — replay recording + server-side replay verification. Only worth building if the game gets popular. Deferred.

Accept that #1–#3 will eventually be broken by someone with an afternoon. That's fine for a Snake game.

---

## 8. PWA Specifics

### Manifest (`manifest.json`)

```json
{
  "name": "Snake",
  "short_name": "Snake",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#9ebd8a",
  "theme_color": "#0e240e",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### iOS quirks (important)

iOS Safari has historically been restrictive with PWAs. Things to know:
- iOS requires a separate `<link rel="apple-touch-icon">` — the manifest icons aren't enough.
- `display: standalone` works, but the status bar styling requires `<meta name="apple-mobile-web-app-status-bar-style">`.
- iOS PWAs previously wiped storage after ~7 days of non-use; Safari has relaxed this for home-screen apps, but treat local storage as potentially ephemeral. Sync scores to the server, don't rely on local state.
- No install prompt API on iOS — users must use "Add to Home Screen" manually. Show a dismissible hint.

### Android

Install prompt API works. Fire `beforeinstallprompt` → show a custom "Install" button.

---

## 9. Build & Deploy Pipeline

### GitHub Actions workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy
on:
  push: { branches: [main] }
  schedule: [{ cron: '0 */6 * * *' }]  # keep-warm ping

jobs:
  build-and-deploy:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist

  keep-warm:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - run: curl -sf "${{ secrets.SUPABASE_URL }}/rest/v1/top_scores_all_time?limit=1" -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

### Secrets

- `SUPABASE_URL` — public URL of your project
- `SUPABASE_ANON_KEY` — anon/public key (safe to ship to client; RLS protects the data)

The anon key ends up in the compiled JS bundle. That's expected and documented by Supabase — security comes from RLS, not from hiding the key.

---

## 10. Repository Layout

```
snake/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql           # scores table, views, RPC, RLS
│   └── README.md                  # how to apply migrations
├── src/                           # (see §4)
├── public/
│   ├── icons/
│   ├── manifest.json
│   └── favicon.ico
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── ARCHITECTURE.md                # this file
└── README.md                      # quick start, play link, credits
```

---

## 11. Non-Goals (explicit scope limits)

- ❌ Multiplayer / real-time. Not a Snake thing.
- ❌ User accounts with email/password. Display name + device is enough.
- ❌ App Store / Play Store distribution. PWA only, per your decision.
- ❌ Cosmetic skins / microtransactions. It's Snake.
- ❌ Anti-cheat beyond basic sanity checks. Deferred until it's a real problem.
- ❌ Ads or analytics. Not needed; Supabase has basic usage metrics.

---

## 12. Milestones

| # | Deliverable | Rough effort |
|---|---|---|
| M1 | Playable Snake in browser, local high score, keyboard only | 1 evening |
| M2 | Mobile swipe controls, responsive layout, iOS viewport quirks handled | 1 evening |
| M3 | PWA manifest + service worker + installable on iOS/Android | ½ evening |
| M4 | Supabase project set up, schema applied, RPC + RLS tested | ½ evening |
| M5 | Leaderboard UI + submit + offline queue + keep-warm cron | 1 evening |
| M6 | Polish: sound, settings, name entry, Nokia aesthetic | 1 evening |
| M7 | GitHub Pages deploy, custom domain (optional), README | ½ evening |

Total: realistically ~1 week of evenings for a working, polished v1.

---

## 13. Open Decisions

Things worth pinning down before or during M1:

- **Visual style.** Authentic Nokia 3310 green LCD, or modernized pixel art?
- **Grid size.** Classic 16×12 or something chunkier like 24×18?
- **Speed curve.** Fixed speed per game, or accelerates as snake grows (classic Nokia behavior)?
- **Wall behavior.** Die on wall collision (classic), or wrap around (common modern variant)?
- **Name entry.** Classic 3-character initials, or free-form up to 16 chars?
- **Leaderboards.** One global, or split by speed preset / daily / weekly?

---

## 14. Key References

- Supabase free tier: 500 MB DB, 5 GB egress, unlimited API requests, pauses after 7 days inactive.
- GitHub Pages: free for public repos, 100 GB/month bandwidth, 1 GB storage.
- PWA on iOS: supported since iOS 11.3; standalone display mode, home screen install via Safari share menu.
- Capacitor (reference only — not used in this plan): available if you later decide to ship native builds.
