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

## Project layout

```
public/    frontend (index.html, app.js, style.css, icons)
src/       server code (index.ts, services, models, types)
data/      curated JSON data + runtime cache (cache files are gitignored)
tests/     (reserved)
```

## License

[MIT](LICENSE)