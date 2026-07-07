/**
 * Pure feature-patch math for the tiles.json manifest.
 * Kept free of I/O and native deps so it can be unit tested.
 *
 * A tile's feature is an F x F RGB patch (row-major, uint8) computed from
 * the image's center square, with transparency baked in: every pixel is
 * composited over the tile's own alpha-weighted mean color, then
 * box-averaged down to F x F. Clients derive the tile's mean color by
 * averaging the patch.
 */

export const FEAT_GRID = 8;

/** Largest centered square crop of (width x height): [x, y, side]. */
export function centerSquare(width, height) {
    const side = Math.min(width, height);
    return [Math.floor((width - side) / 2), Math.floor((height - side) / 2), side];
}

/**
 * Compute the feature patch from raw RGBA bytes (row-major, 4 channels).
 * Returns a Uint8Array of F*F*3 bytes, or null when the image is fully
 * transparent.
 *
 * @param {Uint8Array|Buffer} rgba - side*side*4 bytes (already center-cropped)
 * @param {number} side - square edge length in pixels
 * @param {number} [F] - feature grid size
 */
export function featurePatch(rgba, side, F = FEAT_GRID) {
    // Alpha-weighted mean color of the whole crop.
    let sr = 0,
        sg = 0,
        sb = 0,
        sa = 0;
    for (let p = 0; p < side * side * 4; p += 4) {
        const a = rgba[p + 3];
        sr += rgba[p] * a;
        sg += rgba[p + 1] * a;
        sb += rgba[p + 2] * a;
        sa += a;
    }
    if (sa === 0) return null; // fully transparent tile
    const mean = [sr / sa, sg / sa, sb / sa];

    // Composite each pixel over the mean, box-averaged per output cell:
    // out = (sum(px * a) + mean * sum(255 - a)) / (255 * n). Cell edges use
    // fractional pixel coverage so any side length divides cleanly.
    const patch = new Uint8Array(F * F * 3);
    const step = side / F;
    for (let cy = 0; cy < F; cy++) {
        const y0 = cy * step,
            y1 = (cy + 1) * step;
        for (let cx = 0; cx < F; cx++) {
            const x0 = cx * step,
                x1 = (cx + 1) * step;
            let r = 0,
                g = 0,
                b = 0,
                a = 0,
                area = 0;
            for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
                const wy = Math.min(y + 1, y1) - Math.max(y, y0);
                for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
                    const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
                    const p = (y * side + x) * 4;
                    const pa = rgba[p + 3];
                    r += rgba[p] * pa * w;
                    g += rgba[p + 1] * pa * w;
                    b += rgba[p + 2] * pa * w;
                    a += pa * w;
                    area += w;
                }
            }
            const total = 255 * area;
            const i = (cy * F + cx) * 3;
            patch[i] = Math.round(Math.min(255, Math.max(0, (r + mean[0] * (total - a)) / total)));
            patch[i + 1] = Math.round(Math.min(255, Math.max(0, (g + mean[1] * (total - a)) / total)));
            patch[i + 2] = Math.round(Math.min(255, Math.max(0, (b + mean[2] * (total - a)) / total)));
        }
    }
    return patch;
}
