import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { labelStats } from "./labelRender";

/**
 * Detail-weighted seed sampling: gradient magnitude + uniform floor ->
 * CDF -> binary-search sampling.
 */
export function sampleSeeds(id, n, rng) {
    const { width: w, height: h, data } = id;
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4)
        gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    const cdf = new Float64Array(w * h);
    let acc = 0,
        base = 0;
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const gx = gray[y * w + Math.min(x + 1, w - 1)] - gray[y * w + Math.max(x - 1, 0)];
            const gy = gray[Math.min(y + 1, h - 1) * w + x] - gray[Math.max(y - 1, 0) * w + x];
            const m = Math.hypot(gx, gy);
            base += m;
            cdf[y * w + x] = acc += m;
        }
    const floor = 0.5 * (base / (w * h)) || 1; // uniform component
    for (let i = 0; i < cdf.length; i++) cdf[i] += floor * (i + 1);
    const total = cdf[cdf.length - 1];
    const seeds = new Float64Array(n * 2); // (y, x) pairs
    for (let s = 0; s < n; s++) {
        const t = rng() * total;
        let lo = 0,
            hi = cdf.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cdf[mid] < t) lo = mid + 1;
            else hi = mid;
        }
        seeds[s * 2] = (lo / w) | 0;
        seeds[s * 2 + 1] = lo % w;
    }
    return seeds;
}

/**
 * Nearest-seed assignment with Lloyd relaxation. Seeds hash into a coarse
 * bucket grid so each pixel only checks nearby seeds (expanding the search
 * square when empty).
 */
export function voronoiLabels(w, h, seeds, iters = 2) {
    const n = seeds.length / 2;
    const labels = new Int32Array(w * h);
    const bucketSize = Math.max(8, Math.sqrt((w * h) / n) | 0);
    const bw = Math.ceil(w / bucketSize),
        bh = Math.ceil(h / bucketSize);
    const maxRing = Math.max(bw, bh);

    for (let pass = 0; pass <= iters; pass++) {
        // Rebuild seed buckets.
        const buckets = Array.from({ length: bw * bh }, () => []);
        for (let s = 0; s < n; s++) {
            const by = Math.min(bh - 1, Math.max(0, (seeds[s * 2] / bucketSize) | 0));
            const bx = Math.min(bw - 1, Math.max(0, (seeds[s * 2 + 1] / bucketSize) | 0));
            buckets[by * bw + bx].push(s);
        }
        // Assign each pixel to the nearest seed in nearby buckets.
        for (let y = 0; y < h; y++) {
            const by = Math.min(bh - 1, (y / bucketSize) | 0);
            for (let x = 0; x < w; x++) {
                const bx = Math.min(bw - 1, (x / bucketSize) | 0);
                let best = -1,
                    bestD = Infinity;
                for (let ring = 1; ring <= maxRing; ring++) {
                    for (let dy = -ring; dy <= ring; dy++) {
                        const yy = by + dy;
                        if (yy < 0 || yy >= bh) continue;
                        for (let dx = -ring; dx <= ring; dx++) {
                            const xx = bx + dx;
                            if (xx < 0 || xx >= bw) continue;
                            for (const s of buckets[yy * bw + xx]) {
                                const d = (seeds[s * 2] - y) ** 2 + (seeds[s * 2 + 1] - x) ** 2;
                                if (d < bestD) {
                                    bestD = d;
                                    best = s;
                                }
                            }
                        }
                    }
                    if (best >= 0) break; // 3x3 (or expanded) window had a seed
                }
                labels[y * w + x] = best;
            }
        }
        if (pass === iters) break;
        // Lloyd step: move each seed to its cell centroid.
        const cy = new Float64Array(n),
            cx = new Float64Array(n),
            cnt = new Float64Array(n);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const s = labels[y * w + x];
                cy[s] += y;
                cx[s] += x;
                cnt[s]++;
            }
        for (let s = 0; s < n; s++)
            if (cnt[s]) {
                seeds[s * 2] = cy[s] / cnt[s];
                seeds[s * 2 + 1] = cx[s] / cnt[s];
            }
    }
    return labels;
}

/**
 * Voronoi: organic jigsaw mosaic. Labels are computed at
 * half resolution; rendering upscales the cell masks.
 */
export function analyzeVoronoi(
    target,
    tiles,
    {
        points = 700,
        lloydIters = 2,
        seam = 0.72,
        variety = 3,
        repeatPenalty = 0,
        seed = 0,
        preserveTransparency = true,
    } = {},
) {
    const W = target.width,
        H = target.height;
    const lw = Math.max(1, W >> 1),
        lh = Math.max(1, H >> 1); // label at half res
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });
    const id = rasterize(target, lw, lh);
    const labels = voronoiLabels(lw, lh, sampleSeeds(id, points, matcher.rng), lloydIters);

    const { means, counts, box, alphas } = labelStats(labels, id, points);
    const idx = new Int32Array(points);
    let hasTransparentCells = false;
    for (let s = 0; s < points; s++) {
        const skip = !counts[s] || (preserveTransparency && alphas[s] < ALPHA_SKIP);
        if (skip && counts[s]) hasTransparentCells = true; // real pixels stay uncovered
        idx[s] = skip ? -1 : matcher.byMean([means[s * 3], means[s * 3 + 1], means[s * 3 + 2]]);
    }

    return { type: "voronoi", width: W, height: H, lw, lh, labels, box, means, idx, seam, hasTransparentCells };
}
