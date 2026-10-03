# Rotom-Dex Pokédex

A handheld-style Pokédex web app, built around the Rotom-Dex from *Pokémon Sun & Moon*. It offers search, moves, abilities, evolution info, type weaknesses, and mini-games.

## Features

- **Search** — browse all Pokémon with filters for type, generation, region, form, evolution stage, and Starter family.
- **Moves & Abilities** — full move list with damage-class/type/z-move metadata and ability descriptions.
- **Evolution & Weakness data** — evolution chains with trigger/item/level, and type weakness tables (including Mega/Gigantamax forms).
- **Mini Games**
  - *Guess the Pokémon* — hint-based guessing game; Mega and Gigantamax forms are included as answers.
  - *Dex Duel* — 2–8 player guessing duel with clue-based rounds, elimination, and tiebreakers.
- **Dark red handheld theme**, shiny toggles, cries (sound) if enabled.

## Tech stack

- Node.js + Express (REST API)
- TypeScript (strict)
- Axios (PokéAPI client with rate limiting)
- Vanilla JS + CSS frontend (no build step needed for `public/`)

## Getting started

Requirements: Node.js 20+.

```bash
npm install
npm run build      # compile TypeScript -> dist/
npm start          # serve at http://localhost:3000
```

Open http://localhost:3000.

### First boot / data fetch

On the first run there is no cache, so the server fetches all Pokémon, species, evolution chains, moves, and abilities from [PokéAPI](https://pokeapi.co). This takes a while (several minutes, rate-limit aware) and the app shows a loading status until it finishes.

Once complete, the data is cached on disk (`data/cache.json`, with a `data/cache.backup.json` mirror). Later boots load instantly from the cache:

- A stale cache (>24h) is **not** a problem — the app boots from it immediately and refreshes data in the background, so there is no downtime.
- If the cache file is missing or corrupt, the backup is restored automatically.

Force a manual refresh (owner-only):

```bash
curl -H "x-owner-key: <OWNER_KEY>" "http://localhost:3000/api/refresh?force=1"
```

## Configuration

| Env var | Purpose | Default |
| --- | --- | --- |
| `POKEDEX_OWNER_KEY` | Key for owner-only endpoints (`/api/owner/*`, `/api/refresh`) | `rotom-owner` |

Set `POKEDEX_OWNER_KEY` to something non-default before running in a real deployment.

## Scripts

- `npm run build` — compile TypeScript
- `npm start` — run the compiled server
- `npm run typecheck` — type-check without emitting

## Deploying to Netlify

The app runs on Netlify as a **static frontend + a catch-all Function**:
`public/` is served by Netlify's CDN and every other path is rewritten to
`netlify/functions/api.ts`, which mounts the same Express app (`netlify.toml`
wires all of this up — build command, publish dir and redirects).

Because Netlify Functions are stateless and short-lived (60 s, 6 MB response
cap), the serverless build differs from the local server:

- **No network access at boot.** The PokeAPI snapshot (`data/cache.json`) is a
  committed, read-only file that's bundled into the function. Cold starts load
  it in ~20 ms.
- **Pagination on `/pokemon`:** responses are pulled from the client in pages of
  400 (`?offset&limit`) so each payload stays well under the 6 MB cap.
- **No background refresh / cache writes.** `/api/refresh` returns a no-op and
  disk writes are disabled on serverless.

### Deploy

1. Push this repo to GitHub.
2. Netlify → **Add new site** → **Import an existing project** → pick the repo.
3. Build command `npm run build`, publish directory `public` (already set in
   `netlify.toml`, so the defaults usually just work).
4. Deploy. That's it.

### Refreshing the dataset (serverless)

The dataset is a snapshot you control. To update it after a new game/API drop:

```bash
npm start                    # local server (fetches/refreshes PokéAPI)
curl -i -X POST "http://localhost:3000/api/refresh?force=1" -H "x-owner-key: rotom-owner"
# wait for it to finish, then:
git add data/cache.json && git commit -m "Update dataset snapshot" && git push
```

Redeploy after the push — the app picks up the new snapshot automatically.

## Project layout

```
public/    frontend (index.html, app.js, style.css, icons)
src/       server code (index.ts, services, models, types)
data/      curated JSON data + runtime cache (cache files are gitignored)
tests/     (reserved)
```

## License

[MIT](LICENSE)