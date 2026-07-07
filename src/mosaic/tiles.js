import { tileOriginalUrl, tilePreviewUrl } from "./constants";

/**
 * Download only the distinct tiles the matcher chose. Uses fetch +
 * createImageBitmap so it works in Web Workers (no Image there). Bitmaps
 * are cached across calls so re-processing reuses downloads.
 *
 * Fetches the "_p.webp" preview variant (same resolution as the original,
 * much smaller file), falling back to the original key if a preview is
 * missing.
 *
 * The cache is keyed by tile KEY, not index. Tile filtering changes what
 * an index means between jobs, but a key's bitmap never changes.
 * @param {number[]} chosenIndices - tile indices (duplicates fine, -1 skipped)
 * @param {import("./manifest").Tile[]} tiles
 * @param {Map<string, ImageBitmap>} [cache] - key -> bitmap, reused across jobs
 * @returns {Promise<Map<number, ImageBitmap>>} index -> bitmap for this job
 */
export async function fetchTiles(chosenIndices, tiles, cache = new Map()) {
    const unique = [...new Set(chosenIndices)].filter((i) => i >= 0);
    const imgs = new Map();
    await Promise.all(
        unique.map(async (i) => {
            const key = tiles[i].key;
            if (!cache.has(key)) {
                let res = await fetch(tilePreviewUrl(key), { mode: "cors" });
                if (!res.ok) res = await fetch(tileOriginalUrl(key), { mode: "cors" });
                if (!res.ok) throw new Error(`Failed to fetch tile: ${key}`);
                cache.set(key, await createImageBitmap(await res.blob()));
            }
            imgs.set(i, cache.get(key));
        }),
    );
    return imgs;
}

/**
 * Fill the cell with its own average color, then draw the tile
 * center-cropped to a square on top. Transparent tiles blend into the
 * mosaic instead of sitting on black boxes; the crop matches how the
 * manifest features were computed.
 */
export function drawTile(ctx, img, x, y, w, h, mean) {
    ctx.fillStyle = `rgb(${mean[0] | 0},${mean[1] | 0},${mean[2] | 0})`;
    ctx.fillRect(x, y, w, h);
    const iw = img.naturalWidth ?? img.width;
    const ih = img.naturalHeight ?? img.height;
    const s = Math.min(iw, ih);
    ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, x, y, w, h);
}

/**
 * Draw only the center-cropped square of the tile, without the mean-color
 * backfill (scatter stickers overlap; a backfill would erase the layer
 * below).
 */
export function drawTileNoFill(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth ?? img.width;
    const ih = img.naturalHeight ?? img.height;
    const s = Math.min(iw, ih);
    ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, x, y, w, h);
}
