import { ALPHA_SKIP } from "../constants";
import { createMatcher } from "../matcher";
import { rasterize } from "../raster";
import { drawTile } from "../tiles";

/**
 * Hex: honeycomb mosaic. Pointy-top hexagons in offset rows;
 * each hexagon gets the best-matching tile clipped to the hex shape.
 * Mostly transparent hexes are never placed.
 */
export function analyzeHex(
    target,
    tiles,
    { cells = 40, variety = 3, repeatPenalty = 0, seed = 0, preserveTransparency = true } = {},
) {
    const W = target.width,
        H = target.height;
    const hexW = Math.max(10, Math.round(W / cells));
    const hexH = Math.round((hexW * 2) / Math.sqrt(3));
    const stepY = Math.round(hexH * 0.75);
    const matcher = createMatcher(tiles, { variety, repeatPenalty, seed });

    // Low-res raster for cheap mean sampling: 1 sample px ≈ half a hex.
    const half = hexW / 2;
    const sw = Math.ceil(W / half),
        sh = Math.ceil(H / half);
    const small = rasterize(target, sw, sh);
    const meanAt = (px, py) => {
        // average the 2x2 samples around a point (RGB + alpha coverage)
        let r = 0,
            g = 0,
            b = 0,
            a = 0,
            n = 0;
        const sx = Math.floor(px / half),
            sy = Math.floor(py / half);
        for (let dy = 0; dy <= 1; dy++)
            for (let dx = 0; dx <= 1; dx++) {
                const x = Math.min(sw - 1, Math.max(0, sx + dx));
                const y = Math.min(sh - 1, Math.max(0, sy + dy));
                const p = (y * sw + x) * 4;
                r += small.data[p];
                g += small.data[p + 1];
                b += small.data[p + 2];
                a += small.data[p + 3];
                n++;
            }
        return [r / n, g / n, b / n, a / n];
    };

    // Collect placements first so tiles can be fetched in one batch.
    const pos = [];
    const meansArr = [];
    const idxArr = [];
    let skipped = 0;
    for (let row = 0, y0 = -(hexH >> 1); y0 < H; row++, y0 += stepY) {
        const xStart = -(hexW >> 1) + (row % 2 ? hexW >> 1 : 0);
        for (let x0 = xStart; x0 < W; x0 += hexW) {
            const mean = meanAt(x0 + hexW / 2, y0 + hexH / 2);
            if (preserveTransparency && mean[3] < ALPHA_SKIP) {
                skipped++; // transparent hex: no tile
                continue;
            }
            pos.push(x0, y0);
            meansArr.push(mean[0], mean[1], mean[2]);
            idxArr.push(matcher.byMean(mean));
        }
    }

    return {
        type: "hex",
        width: W,
        height: H,
        hexW,
        hexH,
        stepY,
        pos: new Float32Array(pos),
        means: new Float32Array(meansArr),
        idx: new Int32Array(idxArr),
        hasTransparentCells: skipped > 0,
    };
}

/** Vertices of a pointy-top hexagon inside its (w x h) bounding box. */
export function hexPath(w, h) {
    const hex = new Path2D();
    hex.moveTo(w / 2, 0);
    hex.lineTo(w, h / 4);
    hex.lineTo(w, (3 * h) / 4);
    hex.lineTo(w / 2, h);
    hex.lineTo(0, (3 * h) / 4);
    hex.lineTo(0, h / 4);
    hex.closePath();
    return hex;
}

/**
 * Render at an arbitrary scale. For fully covered mosaics the target draws
 * first as a backstop behind edge hexes; when transparency skipped some
 * hexes, the backstop is dropped — it would leak the original image through
 * the uncovered areas.
 */
export function renderHex(model, imgs, scale, target) {
    const { hexW, hexH, pos, means, idx } = model;
    const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(model.width * scale)),
        Math.max(1, Math.round(model.height * scale)),
    );
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    if (!model.hasTransparentCells) {
        ctx.drawImage(target, 0, 0, canvas.width, canvas.height); // backstop behind edge hexes
    }

    const w = hexW * scale,
        h = hexH * scale;
    // Overdraw by half a pixel so adjacent clips share edge pixels with no
    // hairline gaps at non-integer scales.
    const hex = hexPath(w + 0.5, h + 0.5);
    const n = idx.length;
    for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.translate(pos[i * 2] * scale - 0.25, pos[i * 2 + 1] * scale - 0.25);
        ctx.clip(hex);
        drawTile(ctx, imgs.get(idx[i]), 0, 0, w + 0.5, h + 0.5, [means[i * 3], means[i * 3 + 1], means[i * 3 + 2]]);
        ctx.restore();
    }
    return canvas;
}
