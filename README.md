# dokimosaic

Turn any image into a mosaic built from Doki's emotes, Mint's emotes, or both.

## Overview

_Development_

- **[Tech Used](#tech-used)**
- **[Running Locally](#running-locally)**
- **[Emote palettes](#emote-palettes)**
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

### Emote palettes

Tiles are grouped into palettes by the prefix of their manifest key, defined in
[src/mosaic/palettes.js](src/mosaic/palettes.js):

| Key prefix    | Palette |
| ------------- | ------- |
| `dokimotes/`  | Doki    |
| `mintomotes/` | Mint    |

Tiles under any other prefix belong to no palette and are always used.

- **Picker.** A **Doki / Mint / Both** control appears at the top of the mosaic options, but only once the
  loaded manifest has tiles from at least two palettes. Until then the site looks and behaves exactly as before.
- **Default and memory.** First-time visitors get Doki. The choice is remembered per browser in the
  `dokimosaic-palette` localStorage key, and a remembered palette that has no tiles falls back to Doki.
  Changing it keeps the target image and applies on the next **Create/Update Mosaic**, like the other options.
- **Matching.** The worker drops tiles from unselected palettes on top of the tile filter's exclusions. The tile
  filter only lists the selected palette's tiles, and exclusions for hidden palettes are kept for when they come back.
- **Names.** Tooltip names come from `<prefix>/emotes.csv` for every palette, merged. A missing CSV (for example
  `mintomotes/emotes.csv` before it exists) only loses that palette's names; its tiles show their raw ids.

To add a palette, add it to `PALETTES` and include its prefix in the generator's subfolders.

### Updating the tile manifest

The mosaic engine matches against `tiles.json`, a precomputed manifest of 8×8 feature patches for every
emote in R2 (served from `https://content.duck-automata.com/dokimosaic/tiles.json`). Regenerate it whenever
emotes are added or updated.

**Preferred: GitHub Actions.** Run the **Generate Tiles Manifest** workflow (Actions tab →
`workflow_dispatch`). It scans the bucket, builds the manifest, and uploads it to R2. These inputs
adjust it without a code change:

| Input               | Default                 | Notes                                                                            |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `subfolders`        | `dokimotes,mintomotes`  | One palette per prefix. An empty or missing prefix just adds no tiles.           |
| `ignore_extensions` | `webp,csv`              | GIFs are included (animated emotes are matched on their first frame).            |
| `ignore_suffixes`   | `_p.webp,_t.webp`       | Preview/thumbnail size variants.                                                 |
| `manifest_key`      | `dokimosaic/tiles.json` | Where the manifest is uploaded. The site always reads `dokimosaic/tiles.json`.   |
| `upload`            | on                      | Uncheck for a dry run; the manifest is still attached to the run as an artifact. |

Requires these repo secrets (an R2 API token with read+write on the `cms-assets` bucket):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

**Local fallback.** The same script runs anywhere Node 22 is installed; pass credentials via environment
variables (nothing is stored on disk):

```bash
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run tiles          # dry run, writes ./tiles.json
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run tiles:upload   # also uploads to R2
```

Configuration (subfolders, ignored extensions/suffixes, bucket, manifest key) lives at the top of
[scripts/generate-tiles.mjs](scripts/generate-tiles.mjs) and can be overridden with `TILES_*` environment variables
(`TILES_SUBFOLDERS`, `TILES_IGNORE_EXTENSIONS`, `TILES_IGNORE_SUFFIXES`, `TILES_MANIFEST_KEY`, `TILES_BUCKET`).
See the script header.

#### Deploy order for a new palette

Deploy this client **before** regenerating the manifest with a new palette's prefix (e.g. `mintomotes`) in it.
Clients from before the palette picker use every tile in the manifest, so they would mix Mint tiles into every
mosaic. After deploying, give open tabs a few minutes to pick up the update banner (it checks every 5 minutes)
before regenerating.

Because `mintomotes` is now in the default subfolders, this applies to a default run as soon as `mintomotes/` has
images in it. Until the client is deployed, run the workflow with `subfolders` set to `dokimotes`.

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
