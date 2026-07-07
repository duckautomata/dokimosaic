import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { labelStats } from "./labelRender";

/**
 * SLIC: k-means in (R, G, B, x, y) space. Deep inside
 * a region the spatial term keeps cells compact; near a boundary color
 * casts the deciding vote, so cell walls settle where colors change.
 */
export function slicLabels(id, nSegments, { compactness = 25, iters = 5 } = {}) {
    const { width: w, height: h, data } = id;
    const S = Math.max(4, Math.round(Math.sqrt((w * h) / nSegments)));

    // Seed centers on a grid, nudged off strong gradients (3x3 search).
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4)
        gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    const grad = (x, y) => {
        const cx = Math.min(Math.max(x, 1), w - 2),
            cy = Math.min(Math.max(y, 1), h - 2);
        return (
            Math.abs(gray[cy * w + cx + 1] - gray[cy * w + cx - 1]) +
            Math.abs(gray[(cy + 1) * w + cx] - gray[(cy - 1) * w + cx])
        );
    };
    const centers = []; // [y, x, r, g, b]
    for (let cy = S >> 1; cy < h; cy += S)
        for (let cx = S >> 1; cx < w; cx += S) {
            let bx = cx,
                by = cy,
                bg = Infinity;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const g = grad(cx + dx, cy + dy);
                    if (g < bg) {
                        bg = g;
                        bx = cx + dx;
                        by = cy + dy;
                    }
                }
            const p = (by * w + bx) * 4;
            centers.push([by, bx, data[p], data[p + 1], data[p + 2]]);
        }

    const labels = new Int32Array(w * h).fill(-1);
    const dists = new Float64Array(w * h);
    const spatialW = (compactness / S) ** 2;

    for (let it = 0; it < iters; it++) {
        dists.fill(Infinity);
        labels.fill(-1);
        // Each center competes only inside its 2S x 2S window -> linear time.
        centers.forEach(([cy, cx, cr, cg, cb], ci) => {
            const y0 = Math.max(0, (cy | 0) - S),
                y1 = Math.min(h, (cy | 0) + S + 1);
            const x0 = Math.max(0, (cx | 0) - S),
                x1 = Math.min(w, (cx | 0) + S + 1);
            for (let y = y0; y < y1; y++)
                for (let x = x0; x < x1; x++) {
                    const i = y * w + x,
                        p = i * 4;
                    const d =
                        (data[p] - cr) ** 2 +
                        (data[p + 1] - cg) ** 2 +
                        (data[p + 2] - cb) ** 2 +
                        spatialW * ((y - cy) ** 2 + (x - cx) ** 2);
                    if (d < dists[i]) {
                        dists[i] = d;
                        labels[i] = ci;
                    }
                }
        });
        // Recompute each cluster's mean position and color.
        const acc = new Float64Array(centers.length * 6);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const s = labels[y * w + x];
                if (s < 0) continue;
                const p = (y * w + x) * 4,
                    a = s * 6;
                acc[a] += y;
                acc[a + 1] += x;
                acc[a + 2] += data[p];
                acc[a + 3] += data[p + 1];
                acc[a + 4] += data[p + 2];
                acc[a + 5]++;
            }
        centers.forEach((c, ci) => {
            const a = ci * 6,
                n = acc[a + 5];
            if (n) {
                c[0] = acc[a] / n;
                c[1] = acc[a + 1] / n;
                c[2] = acc[a + 2] / n;
                c[3] = acc[a + 3] / n;
                c[4] = acc[a + 4] / n;
            }
        });
    }

    // Orphans (never inside any window): nearest center by position.
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (labels[i] >= 0) continue;
            let best = 0,
                bd = Infinity;
            centers.forEach(([cy, cx], ci) => {
                const d = (cy - y) ** 2 + (cx - x) ** 2;
                if (d < bd) {
                    bd = d;
                    best = ci;
                }
            });
            labels[i] = best;
        }
    return { labels, count: centers.length };
}

/**
 * Superpixel: SLIC cells that hug image edges.
 * Match/render is identical to voronoi (shared label model); seams are
 * skipped, the edge-following boundaries are the aesthetic.
 */
export function analyzeSuperpixel(
    target,
    tiles,
    {
        points = 700,
        compactness = 25,
        iters = 5,
        variety = 3,
        repeatPenalty = 0,
        seed = 0,
        preserveTransparency = true,
    } = {},
) {
    const W = target.width,
        H = target.height;
    const lw = Math.max(1, W >> 1),
        lh = Math.max(1, H >> 1); // half res is plenty
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });
    const id = rasterize(target, lw, lh);
    const { labels, count } = slicLabels(id, points, { compactness, iters });

    const { means, counts, box, alphas } = labelStats(labels, id, count);
    const idx = new Int32Array(count);
    let hasTransparentCells = false;
    for (let s = 0; s < count; s++) {
        const skip = !counts[s] || (preserveTransparency && alphas[s] < ALPHA_SKIP);
        if (skip && counts[s]) hasTransparentCells = true; // real pixels stay uncovered
        idx[s] = skip ? -1 : matcher.byMean([means[s * 3], means[s * 3 + 1], means[s * 3 + 2]]);
    }

    return { type: "superpixel", width: W, height: H, lw, lh, labels, box, means, idx, seam: 1, hasTransparentCells };
}
