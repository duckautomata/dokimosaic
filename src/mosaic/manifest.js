import { MANIFEST_URL } from "./constants";

/**
 * @typedef {Object} Tile
 * @property {string} key - CDN path suffix, e.g. "dokimotes/abc.png"
 * @property {Float32Array} feat - F*F*3 RGB patch, row-major, 0-255
 * @property {[number, number, number]} mean - average RGB of the patch
 * @property {number} F - feature grid size (8)
 */

/**
 * Decode a raw manifest object ({ featGrid, tiles: [{key, feat}] }) into
 * usable tile records. Transparency is already baked into the features, so
 * the mean is simply the average of the patch.
 * @returns {Tile[]}
 */
export function decodeManifest(manifest) {
    const F = manifest.featGrid;
    return manifest.tiles.map((t) => {
        const bin = atob(t.feat);
        const feat = new Float32Array(bin.length);
        for (let i = 0; i < bin.length; i++) feat[i] = bin.charCodeAt(i);
        let r = 0,
            g = 0,
            b = 0;
        for (let i = 0; i < feat.length; i += 3) {
            r += feat[i];
            g += feat[i + 1];
            b += feat[i + 2];
        }
        const n = feat.length / 3;
        return { key: t.key, feat, mean: [r / n, g / n, b / n], F };
    });
}

let cached = null;

/**
 * Fetch and decode tiles.json once; subsequent calls reuse the result.
 * @returns {Promise<Tile[]>}
 */
export async function loadManifest(url = MANIFEST_URL) {
    if (!cached) {
        cached = (async () => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to load tile manifest (${res.status})`);
            return decodeManifest(await res.json());
        })().catch((err) => {
            cached = null; // allow retry after a failure
            throw err;
        });
    }
    return cached;
}
