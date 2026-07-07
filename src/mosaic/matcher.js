import { bestByFeat, bestByMean, pickVariety } from "./matching";
import { mulberry32 } from "./rng";

/**
 * Stateful matcher shared by the algorithms: seeded variety picks plus the
 * optional usage penalty (inflate distances by (1 + penalty * usage[i]), increment the winner).
 * Penalized picks are order-dependent by design, rank cells one at a time.
 */
export function createMatcher(tiles, { variety = 3, repeatPenalty = 0, seed = 0 } = {}) {
    const rng = mulberry32(seed);
    const usage = repeatPenalty > 0 ? new Float32Array(tiles.length) : null;
    return {
        rng,
        byMean(mean) {
            const idx = pickVariety(bestByMean(tiles, mean, variety, usage, repeatPenalty), rng);
            if (usage) usage[idx]++;
            return idx;
        },
        byFeat(feat) {
            const idx = pickVariety(bestByFeat(tiles, feat, variety, usage, repeatPenalty), rng);
            if (usage) usage[idx]++;
            return idx;
        },
    };
}
