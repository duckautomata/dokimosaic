import { ALPHA_SKIP } from "../constants";
import { bestByMean } from "../matching";
import { rasterize } from "../raster";

/**
 * Dither: fixed grid with Floyd–Steinberg error diffusion.
 * Cells are processed sequentially with k = 1: the diffusion itself provides
 * the variation, and randomness would fight the error accounting. Mostly
 * transparent cells get no tile and absorb no diffused error.
 */
export function analyzeDither(target, tiles, { cells = 50, preserveTransparency = true } = {}) {
    const cell = Math.max(8, Math.round(target.width / cells));
    const cols = Math.max(1, Math.floor(target.width / cell));
    const rows = Math.max(1, Math.floor(target.height / cell));

    const small = rasterize(target, cols, rows).data;
    const err = new Float32Array(cols * rows * 3);
    const n = cols * rows;
    const means = new Float32Array(n * 3);
    const idx = new Int32Array(n);

    const clamp = (v) => Math.max(0, Math.min(255, v));
    const spread = [
        [0, 1, 7 / 16],
        [1, -1, 3 / 16],
        [1, 0, 5 / 16],
        [1, 1, 1 / 16],
    ];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            if (preserveTransparency && small[i * 4 + 3] < ALPHA_SKIP) {
                idx[i] = -1; // transparent cell: no tile, diffused error discarded
                continue;
            }
            const m = [small[i * 4], small[i * 4 + 1], small[i * 4 + 2]];
            means[i * 3] = m[0];
            means[i * 3 + 1] = m[1];
            means[i * 3 + 2] = m[2];
            const want = [clamp(m[0] + err[i * 3]), clamp(m[1] + err[i * 3 + 1]), clamp(m[2] + err[i * 3 + 2])];
            const best = bestByMean(tiles, want, 1)[0];
            idx[i] = best;

            // Diffuse the residual to unprocessed neighbors.
            const res = [want[0] - tiles[best].mean[0], want[1] - tiles[best].mean[1], want[2] - tiles[best].mean[2]];
            for (const [dr, dc, w] of spread) {
                const rr = r + dr,
                    cc = c + dc;
                if (rr < rows && cc >= 0 && cc < cols) {
                    const j = (rr * cols + cc) * 3;
                    err[j] += res[0] * w;
                    err[j + 1] += res[1] * w;
                    err[j + 2] += res[2] * w;
                }
            }
        }
    }

    return { type: "dither", width: cols * cell, height: rows * cell, cols, rows, cell, means, idx };
}
