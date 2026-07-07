import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { drawTile } from "../tiles";

/**
 * Grid: classic fixed-grid photomosaic. Cells and tiles are
 * compared by average color only. With preserveTransparency, mostly
 * transparent cells get no tile (idx -1) and stay transparent.
 */
export function analyzeGrid(
    target,
    tiles,
    { cells = 50, variety = 3, repeatPenalty = 0, seed = 0, preserveTransparency = true } = {},
) {
    const cell = Math.max(8, Math.round(target.width / cells));
    const cols = Math.max(1, Math.floor(target.width / cell));
    const rows = Math.max(1, Math.floor(target.height / cell));
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });

    // Cell means: one downscale, one pixel read per cell. The premultiplied
    // downscale makes each pixel's RGB the alpha-weighted mean of the
    // cell's visible content, and its alpha the cell's coverage.
    const small = rasterize(target, cols, rows).data; // RGBA
    const n = cols * rows;
    const means = new Float32Array(n * 3);
    const idx = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        if (preserveTransparency && small[i * 4 + 3] < ALPHA_SKIP) {
            idx[i] = -1;
            continue;
        }
        const m = [small[i * 4], small[i * 4 + 1], small[i * 4 + 2]];
        means[i * 3] = m[0];
        means[i * 3 + 1] = m[1];
        means[i * 3 + 2] = m[2];
        idx[i] = matcher.byMean(m);
    }

    return { type: "grid", width: cols * cell, height: rows * cell, cols, rows, cell, means, idx };
}

/**
 * Render a grid-family model (grid/dither share it; blend adds a pass) at
 * an arbitrary scale. Cell edges are rounded per-boundary so the canvas
 * tiles exactly with no seams.
 */
export function renderGrid(model, imgs, scale) {
    const { cols, rows, cell, means, idx } = model;
    const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(model.width * scale)),
        Math.max(1, Math.round(model.height * scale)),
    );
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    for (let r = 0; r < rows; r++) {
        const y0 = Math.round(r * cell * scale);
        const y1 = r === rows - 1 ? canvas.height : Math.round((r + 1) * cell * scale);
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            if (idx[i] < 0) continue; // transparent cell
            const x0 = Math.round(c * cell * scale);
            const x1 = c === cols - 1 ? canvas.width : Math.round((c + 1) * cell * scale);
            drawTile(ctx, imgs.get(idx[i]), x0, y0, x1 - x0, y1 - y0, [
                means[i * 3],
                means[i * 3 + 1],
                means[i * 3 + 2],
            ]);
        }
    }
    return canvas;
}
