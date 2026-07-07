# dokimosaic

Turn any image into a mosaic built from Doki's emotes.

## Overview

_Development_

- **[Tech Used](#tech-used)**
- **[Running Locally](#running-locally)**
- **[Updating the tile manifest](#updating-the-tile-manifest)**
- **[Contributing](#contributing)**
- **[Contributing Ideas](#contrubiting-ideas)**
- **[Building a Release](#building-a-new-release)**
- **[Release Process](#release-process)**

## Development

### Tech Used

- Node 22
- Vite to run locally

### Running Locally

1. Have Node 22 or later installed
2. Clone the repo locally
3. Run `npm install` to install dependencies
4. Run `npm run dev` and open the site it gives you. Or press `o` and enter to open the site.

Every time you save, Vite will automatically refresh the cache and the site should refresh with the new changes.

> **Note:** the feedback form talks to the shared content-manager backend, which only allows the deployed origins.
> Locally its config fetch fails with a CORS error. Use `npm run dev:mock` to exercise the feedback
> flow against the mock API (shows the purple "Mock API" badge and a mock Turnstile).

#### Update Command

```bash
npx npm-check-updates -u --cooldown 7; npm install; npm audit; npm audit signatures --min-release-age=0
```

if any of the install/update commands are failing, you can add `--min-release-age=0` to it to bypass the minimum release age restriction.

### Updating the tile manifest

The mosaic engine matches against `tiles.json`, a precomputed manifest of 8×8 feature patches for every
emote in R2 (served from `https://content.duck-automata.com/dokimosaic/tiles.json`). Regenerate it whenever
emotes are added or updated.

**Preferred: GitHub Actions.** Run the **Generate Tiles Manifest** workflow (Actions tab →
`workflow_dispatch`). It scans the bucket, builds the manifest, and uploads it to R2. The subfolders,
ignored extensions, and ignored suffixes (`_p.webp`/`_t.webp` size variants) are workflow inputs, so no
code change is needed to adjust them. Requires these repo secrets (an R2 API token with read+write on the
`cms-assets` bucket):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

**Local fallback.** The same script runs anywhere Node 22 is installed; pass credentials via environment
variables (nothing is stored on disk):

```bash
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run tiles          # dry run, writes ./tiles.json
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run tiles:upload   # also uploads to R2
```

Configuration (subfolders, ignored extensions/suffixes, bucket) lives at the top of
[scripts/generate-tiles.mjs](scripts/generate-tiles.mjs) and can be overridden with `TILES_*` environment variables. See the script header.

### Contributing

1. create a branch and put your code onto it.
2. Run `npm run test`, `npm run format`, `npm run lint` and make sure everything is all good.
3. Push, raise pr, I'll approve.

### Contributing ideas

Raise an issue and detail what idea you have or would like to see.

### Building a new release

This project is hosted in a Cloudflare worker. If you have access to the worker, then run the deploy command to update the contents.

```bash
npm run deploy
```
