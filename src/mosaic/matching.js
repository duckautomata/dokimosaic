/**
 * Tile matching over the manifest features. All matchers return top-k tile
 * indices sorted best-first. The optional usage penalty
 * discourages one tile dominating flat regions: distances are inflated by
 * (1 + penalty * usage[i]) and the caller increments the winner's count.
 */

/** Top-k tile indices by squared distance of mean color. */
export function bestByMean(tiles, m, k = 1, usage = null, penalty = 0) {
    const scored = tiles.map((t, i) => {
        const dr = t.mean[0] - m[0],
            dg = t.mean[1] - m[1],
            db = t.mean[2] - m[2];
        let d = dr * dr + dg * dg + db * db;
        if (usage && penalty > 0) d *= 1 + penalty * usage[i];
        return [d, i];
    });
    scored.sort((a, b) => a[0] - b[0]);
    return scored.slice(0, Math.min(k, scored.length)).map((s) => s[1]);
}

/** Top-k tile indices by squared distance over the full 8x8x3 patch. */
export function bestByFeat(tiles, feat, k = 1, usage = null, penalty = 0) {
    const scored = tiles.map((t, i) => {
        let d = 0;
        for (let j = 0; j < feat.length; j++) {
            const e = t.feat[j] - feat[j];
            d += e * e;
        }
        if (usage && penalty > 0) d *= 1 + penalty * usage[i];
        return [d, i];
    });
    scored.sort((a, b) => a[0] - b[0]);
    return scored.slice(0, Math.min(k, scored.length)).map((s) => s[1]);
}

/**
 * Weighted pick among the top-k (weight 1/rank) so flat regions vary
 * instead of repeating one tile. With k = 1 this always takes the best
 * match (which also minimizes distinct tile downloads).
 */
export function pickVariety(topK, rng) {
    let total = 0;
    const w = topK.map((_, i) => {
        total += 1 / (i + 1);
        return 1 / (i + 1);
    });
    let x = rng() * total;
    for (let i = 0; i < w.length; i++) {
        x -= w[i];
        if (x <= 0) return topK[i];
    }
    return topK[topK.length - 1];
}
