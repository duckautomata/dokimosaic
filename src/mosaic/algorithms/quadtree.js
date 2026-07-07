import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { drawTile } from "../tiles";

/**
 * Integral images (summed-area tables) over grayscale, sum and
 * sum-of-squares, so the variance of any rectangle costs O(1).
 */
export function buildIntegrals(id) {
    const { width: w, height: h, data } = id;
    const sum = new Float64Array((w + 1) * (h + 1));
    const sq = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
        let rowSum = 0,
            rowSq = 0;
        for (let x = 0; x < w; x++) {
            const p = (y * w + x) * 4;
            const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
            rowSum += g;
            rowSq += g * g;
            const i = (y + 1) * (w + 1) + (x + 1);
            sum[i] = sum[i - (w + 1)] + rowSum;
            sq[i] = sq[i - (w + 1)] + rowSq;
        }
    }
    const rect = (t, x, y, rw, rh) =>
        t[(y + rh) * (w + 1) + x + rw] - t[y * (w + 1) + x + rw] - t[(y + rh) * (w + 1) + x] + t[y * (w + 1) + x];
    return {
        std(x, y, rw, rh) {
            const n = rw * rh;
            const mean = rect(sum, x, y, rw, rh) / n;
            return Math.sqrt(Math.max(0, rect(sq, x, y, rw, rh) / n - mean * mean));
        },
    };
}

/**
 * Recursive split: regions with detail (grayscale std above the threshold)
 * split into quadrants; never below minCell, always above maxCell.
 */
export function quadtreeLeaves(integrals, W, H, { minCell = 16, maxCell, varThreshold = 18 }) {
    maxCell ??= Math.max(2 * minCell, Math.floor(Math.min(W, H) / 5));
    const leaves = [];
    (function rec(x, y, w, h) {
        const canSplit = w >= 2 * minCell && h >= 2 * minCell;
        const mustSplit = w > maxCell || h > maxCell;
        if (canSplit && (mustSplit || integrals.std(x, y, w, h) > varThreshold)) {
            const w2 = w >> 1,
                h2 = h >> 1;
            rec(x, y, w2, h2);
            rec(x + w2, y, w - w2, h2);
            rec(x, y + h2, w2, h - h2);
            rec(x + w2, y + h2, w - w2, h - h2);
        } else leaves.push([x, y, w, h]);
    })(0, 0, W, H);
    return leaves;
}

/**
 * Rasterize one region of the target to an F x F feature patch and return
 * { mean, alpha } (alpha = mean coverage, 0-255). Shared with fractal.
 * With alphaAware, the mean is alpha-weighted and fully transparent patch
 * pixels are filled with it so they don't read as black during matching.
 */
export function leafFeature(fctx, target, x, y, w, h, F, feat, alphaAware = false) {
    fctx.clearRect(0, 0, F, F);
    fctx.drawImage(target, x, y, w, h, 0, 0, F, F);
    const d = fctx.getImageData(0, 0, F, F).data;
    const n = feat.length / 3;

    let mr = 0,
        mg = 0,
        mb = 0,
        ma = 0;
    if (alphaAware) {
        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            mr += d[i] * a;
            mg += d[i + 1] * a;
            mb += d[i + 2] * a;
            ma += a;
        }
        const mean = ma ? [mr / ma, mg / ma, mb / ma] : [0, 0, 0];
        for (let i = 0, j = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) {
                feat[j++] = mean[0];
                feat[j++] = mean[1];
                feat[j++] = mean[2];
            } else {
                feat[j++] = d[i];
                feat[j++] = d[i + 1];
                feat[j++] = d[i + 2];
            }
        }
        return { mean, alpha: ma / n };
    }

    for (let i = 0, j = 0; i < d.length; i += 4) {
        feat[j++] = d[i];
        feat[j++] = d[i + 1];
        feat[j++] = d[i + 2];
    }
    for (let j = 0; j < feat.length; j += 3) {
        mr += feat[j];
        mg += feat[j + 1];
        mb += feat[j + 2];
    }
    return { mean: [mr / n, mg / n, mb / n], alpha: 255 };
}

/**
 * Quadtree: dynamic tile sizes by detail.
 */
export function analyzeQuadtree(
    target,
    tiles,
    { minCell = 16, varThreshold = 18, variety = 3, repeatPenalty = 0, seed = 0, preserveTransparency = true } = {},
) {
    const W = target.width,
        H = target.height;
    const id = rasterize(target, W, H);
    const leaves = quadtreeLeaves(buildIntegrals(id), W, H, { minCell, varThreshold });
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });
    const F = tiles[0].F;

    const fc = new OffscreenCanvas(F, F);
    const fctx = fc.getContext("2d", { willReadFrequently: true });
    fctx.imageSmoothingQuality = "high";
    const feat = new Float32Array(F * F * 3);

    const n = leaves.length;
    const rects = new Int32Array(n * 4);
    const means = new Float32Array(n * 3);
    const idx = new Int32Array(n);
    leaves.forEach(([x, y, w, h], i) => {
        const lf = leafFeature(fctx, target, x, y, w, h, F, feat, preserveTransparency);
        rects[i * 4] = x;
        rects[i * 4 + 1] = y;
        rects[i * 4 + 2] = w;
        rects[i * 4 + 3] = h;
        if (preserveTransparency && lf.alpha < ALPHA_SKIP) {
            idx[i] = -1; // mostly transparent leaf: stays transparent
            return;
        }
        means[i * 3] = lf.mean[0];
        means[i * 3 + 1] = lf.mean[1];
        means[i * 3 + 2] = lf.mean[2];
        idx[i] = matcher.byFeat(feat);
    });

    return { type: "quadtree", width: W, height: H, rects, means, idx };
}

/** Render quadtree leaves at an arbitrary scale (edge-rounded rects). */
export function renderQuadtree(model, imgs, scale) {
    const { rects, means, idx } = model;
    const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(model.width * scale)),
        Math.max(1, Math.round(model.height * scale)),
    );
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    const n = idx.length;
    for (let i = 0; i < n; i++) {
        if (idx[i] < 0) continue; // transparent leaf
        const x = rects[i * 4],
            y = rects[i * 4 + 1],
            w = rects[i * 4 + 2],
            h = rects[i * 4 + 3];
        const x0 = Math.round(x * scale),
            y0 = Math.round(y * scale);
        const x1 = Math.round((x + w) * scale),
            y1 = Math.round((y + h) * scale);
        drawTile(ctx, imgs.get(idx[i]), x0, y0, x1 - x0, y1 - y0, [means[i * 3], means[i * 3 + 1], means[i * 3 + 2]]);
    }
    return canvas;
}
