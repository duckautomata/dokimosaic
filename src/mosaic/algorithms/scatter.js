import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { drawTileNoFill } from "../tiles";

// [size as fraction of min(W,H), share of count] - painted big to small so
// fine stickers refine the coarse layer.
const TIERS = [
    [1 / 6, 0.15],
    [1 / 10, 0.3],
    [1 / 16, 0.55],
];

/**
 * Scatter: overlapping sticker collage. No partition:
 * tiles are stamped at random detail-biased positions over a blurred copy
 * of the target.
 */
export function analyzeScatter(
    target,
    tiles,
    { count = 1200, variety = 4, maxAngle = 35, repeatPenalty = 0, seed = 0, preserveTransparency = true } = {},
) {
    const W = target.width,
        H = target.height;
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });
    const rng = matcher.rng;

    // Sampling CDF: mostly uniform with a mild pull toward edges. (A strong
    // detail bias starves flat regions of stickers.)
    const sw = Math.max(1, W >> 3),
        sh = Math.max(1, H >> 3); // 1/8 res is plenty
    const small = rasterize(target, sw, sh);
    const gray = new Float32Array(sw * sh);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4)
        gray[i] = 0.299 * small.data[p] + 0.587 * small.data[p + 1] + 0.114 * small.data[p + 2];
    const cdf = new Float64Array(sw * sh);
    let acc = 0,
        sum = 0;
    for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
            const gx = gray[y * sw + Math.min(x + 1, sw - 1)] - gray[y * sw + Math.max(x - 1, 0)];
            const gy = gray[Math.min(y + 1, sh - 1) * sw + x] - gray[Math.max(y - 1, 0) * sw + x];
            sum += Math.hypot(gx, gy);
            cdf[y * sw + x] = acc += Math.hypot(gx, gy);
        }
    const floor = 1.5 * (sum / (sw * sh)) || 1;
    for (let i = 0; i < cdf.length; i++) cdf[i] += floor * (i + 1);
    const total = cdf[cdf.length - 1];
    const samplePos = () => {
        const t = rng() * total;
        let lo = 0,
            hi = cdf.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cdf[mid] < t) lo = mid + 1;
            else hi = mid;
        }
        return [((lo % sw) + 0.5) * 8, (((lo / sw) | 0) + 0.5) * 8]; // back to full res
    };
    const meanAt = (cx, cy, s) => {
        // average of the low-res raster under the sticker's bounding box
        let r = 0,
            g = 0,
            b = 0,
            a = 0,
            n = 0;
        const x0 = Math.max(0, (cx - s / 2) >> 3),
            x1 = Math.min(sw - 1, (cx + s / 2) >> 3);
        const y0 = Math.max(0, (cy - s / 2) >> 3),
            y1 = Math.min(sh - 1, (cy + s / 2) >> 3);
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                const p = (y * sw + x) * 4;
                r += small.data[p];
                g += small.data[p + 1];
                b += small.data[p + 2];
                a += small.data[p + 3];
                n++;
            }
        return [r / n, g / n, b / n, a / n];
    };

    // Plan all placements (big tier first) so tiles fetch in one batch.
    // Positions landing on transparent areas re-roll a few times so the
    // sticker count concentrates on the visible subject.
    const data = [];
    const idxArr = [];
    for (const [sizeFrac, share] of TIERS) {
        const n = Math.max(1, Math.round(count * share));
        const base = sizeFrac * Math.min(W, H);
        for (let i = 0; i < n; i++) {
            for (let attempt = 0; attempt < 10; attempt++) {
                const [cx, cy] = samplePos();
                const s = Math.round(base * (0.8 + rng() * 0.45));
                const mean = meanAt(cx, cy, s);
                if (preserveTransparency && mean[3] < ALPHA_SKIP) continue;
                data.push(cx, cy, s, ((rng() * 2 - 1) * maxAngle * Math.PI) / 180);
                idxArr.push(matcher.byMean(mean));
                break;
            }
        }
    }

    return { type: "scatter", width: W, height: H, data: new Float32Array(data), idx: new Int32Array(idxArr) };
}

/**
 * Render at an arbitrary scale over a blurred copy of the target so gaps
 * between stickers stay plausible. Falls back to downscale-upscale blur
 * where ctx.filter is unsupported.
 */
export function renderScatter(model, imgs, scale, target) {
    const { data, idx } = model;
    const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(model.width * scale)),
        Math.max(1, Math.round(model.height * scale)),
    );
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    ctx.filter = `blur(${Math.max(1, Math.round(8 * scale))}px)`;
    if (ctx.filter === "none") {
        // ctx.filter unsupported: a 1/8 downscale-upscale is an equivalent
        // cheap blur.
        const bw = Math.max(1, canvas.width >> 3),
            bh = Math.max(1, canvas.height >> 3);
        const b = new OffscreenCanvas(bw, bh);
        b.getContext("2d").drawImage(target, 0, 0, bw, bh);
        ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.drawImage(target, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
    }

    const n = idx.length;
    for (let i = 0; i < n; i++) {
        const cx = data[i * 4] * scale,
            cy = data[i * 4 + 1] * scale;
        const s = data[i * 4 + 2] * scale,
            angle = data[i * 4 + 3];
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        drawTileNoFill(ctx, imgs.get(idx[i]), -s / 2, -s / 2, s, s); // no bg fill: stickers overlap
        ctx.restore();
    }
    return canvas;
}
