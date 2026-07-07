import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { renderGrid } from "./grid";

/**
 * Blend: sub-image matching + color blending. Cells match
 * tiles as 8x8 patches so internal edges survive; after placement each
 * cell's pixels are shifted by a fraction of (cellColor - drawnColor),
 * a uniform offset, not an opacity fade.
 */
export function analyzeBlend(
    target,
    tiles,
    { cells = 50, variety = 3, blendStrength = 0.55, repeatPenalty = 0, seed = 0, preserveTransparency = true } = {},
) {
    const F = tiles[0].F; // 8
    const cell = Math.max(F, Math.round(target.width / cells));
    const cols = Math.max(1, Math.floor(target.width / cell));
    const rows = Math.max(1, Math.floor(target.height / cell));
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });

    const small = rasterize(target, cols, rows).data; // means
    const fine = rasterize(target, cols * F, rows * F).data; // features

    const n = cols * rows;
    const means = new Float32Array(n * 3);
    const idx = new Int32Array(n);
    const feat = new Float32Array(F * F * 3);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            if (preserveTransparency && small[i * 4 + 3] < ALPHA_SKIP) {
                idx[i] = -1; // mostly transparent cell: no tile
                continue;
            }
            means[i * 3] = small[i * 4];
            means[i * 3 + 1] = small[i * 4 + 1];
            means[i * 3 + 2] = small[i * 4 + 2];
            // Gather the cell's 8x8 patch out of the fine raster. Fully
            // transparent patch pixels read as black; substitute the cell
            // mean so silhouette-edge cells don't skew toward dark tiles.
            let j = 0;
            for (let y = 0; y < F; y++) {
                let p = ((r * F + y) * cols * F + c * F) * 4;
                for (let x = 0; x < F; x++, p += 4) {
                    if (preserveTransparency && fine[p + 3] === 0) {
                        feat[j++] = means[i * 3];
                        feat[j++] = means[i * 3 + 1];
                        feat[j++] = means[i * 3 + 2];
                    } else {
                        feat[j++] = fine[p];
                        feat[j++] = fine[p + 1];
                        feat[j++] = fine[p + 2];
                    }
                }
            }
            idx[i] = matcher.byFeat(feat);
        }
    }

    return { type: "blend", width: cols * cell, height: rows * cell, cols, rows, cell, means, idx, blendStrength };
}

/**
 * Render = grid draw + blending pass at the requested scale: one
 * getImageData over the finished mosaic, then shift each cell's pixels
 * toward the target cell color (clamped by Uint8ClampedArray).
 */
export function renderBlend(model, imgs, scale) {
    const canvas = renderGrid(model, imgs, scale);
    const { cols, rows, cell, means, idx, blendStrength } = model;
    if (!blendStrength) return canvas;

    const ctx = canvas.getContext("2d");
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = id.data;
    const W = canvas.width;
    for (let r = 0; r < rows; r++) {
        const y0 = Math.round(r * cell * scale);
        const y1 = r === rows - 1 ? canvas.height : Math.round((r + 1) * cell * scale);
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            if (idx[i] < 0) continue; // transparent cell: nothing to blend
            const x0 = Math.round(c * cell * scale);
            const x1 = c === cols - 1 ? canvas.width : Math.round((c + 1) * cell * scale);
            // Measure what actually got drawn (tile over bg fill)…
            let sr = 0,
                sg = 0,
                sb = 0;
            for (let y = y0; y < y1; y++)
                for (let x = x0, p = (y * W + x) * 4; x < x1; x++, p += 4) {
                    sr += px[p];
                    sg += px[p + 1];
                    sb += px[p + 2];
                }
            const n = Math.max(1, (x1 - x0) * (y1 - y0));
            // …and shift by a fraction of the difference from the target.
            const dr = (means[i * 3] - sr / n) * blendStrength;
            const dg = (means[i * 3 + 1] - sg / n) * blendStrength;
            const db = (means[i * 3 + 2] - sb / n) * blendStrength;
            for (let y = y0; y < y1; y++)
                for (let x = x0, p = (y * W + x) * 4; x < x1; x++, p += 4) {
                    px[p] += dr;
                    px[p + 1] += dg;
                    px[p + 2] += db;
                }
        }
    }
    ctx.putImageData(id, 0, 0);
    return canvas;
}
