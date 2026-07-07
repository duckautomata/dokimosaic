import { ALPHA_SKIP } from "../constants";
import { rasterize } from "../raster";
import { drawTile } from "../tiles";
import { buildIntegrals, leafFeature, quadtreeLeaves } from "./quadtree";

// Contrast scale clamp: the floor keeps tiles visible in flat blocks
// (without it, flat regions collapse into solid color fills).
const S_FLOOR = 0.45;
const S_MAX = 2.2;

/** Where does (x, y) land under orientation o? */
export function orientIndex(x, y, o, F) {
    if (o & 4) x = F - 1 - x; // flip horizontally
    for (let k = o & 3; k > 0; k--) [x, y] = [y, F - 1 - x]; // 90° CCW rotations
    return y * F + x;
}

/**
 * Precompute oriented tile features (once per tile): grayscale of each
 * tile's patch in all 8 dihedral orientations, zero-mean and unit-norm, so
 * matching is a plain dot product = correlation. Guarded per tile with
 * tile filtering, different jobs see different subsets of the library.
 */
export function prepareFractal(tiles) {
    const F = tiles[0].F,
        n = F * F;
    for (const t of tiles) {
        if (t.oriented) continue; // already prepared
        const gray = new Float32Array(n);
        for (let i = 0; i < n; i++)
            gray[i] = 0.299 * t.feat[i * 3] + 0.587 * t.feat[i * 3 + 1] + 0.114 * t.feat[i * 3 + 2];
        const mean = gray.reduce((a, b) => a + b) / n;
        t.grayStd = Math.sqrt(gray.reduce((a, g) => a + (g - mean) ** 2, 0) / n) + 1e-6;
        t.oriented = []; // 8 normalized variants
        for (let o = 0; o < 8; o++) {
            const v = new Float32Array(n);
            for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) v[orientIndex(x, y, o, F)] = gray[y * F + x];
            let norm = 0;
            for (let i = 0; i < n; i++) {
                v[i] -= mean;
                norm += v[i] * v[i];
            }
            norm = Math.sqrt(norm) + 1e-6;
            for (let i = 0; i < n; i++) v[i] /= norm;
            t.oriented.push(v);
        }
    }
}

/**
 * Best correlation over every tile x orientation for one normalized
 * grayscale block, plus the clamped contrast scale.
 */
export function matchLeaf(blockGray, tiles) {
    const n = blockGray.length;
    const mean = blockGray.reduce((a, b) => a + b) / n;
    let norm = 0;
    const b = blockGray.map((g) => g - mean);
    for (const v of b) norm += v * v;
    const bStd = Math.sqrt(norm / n);
    norm = Math.sqrt(norm) + 1e-6;
    for (let i = 0; i < n; i++) b[i] /= norm;

    let best = { corr: -2, idx: 0, orient: 0 };
    tiles.forEach((t, ti) =>
        t.oriented.forEach((v, o) => {
            let dot = 0;
            for (let i = 0; i < n; i++) dot += v[i] * b[i];
            if (dot > best.corr) best = { corr: dot, idx: ti, orient: o };
        }),
    );
    const s = Math.min(S_MAX, Math.max(S_FLOOR, (Math.max(best.corr, 0) * bStd) / tiles[best.idx].grayStd));
    return { ...best, s };
}

/**
 * Fractal: scale/translation/rotation-invariant matching borrowed from
 * PIFS image compression. Tiles match by internal
 * structure and are recolored through s·(tile − tileMean) + blockMean.
 */
export function analyzeFractal(target, tiles, { minCell = 20, varThreshold = 14, preserveTransparency = true } = {}) {
    prepareFractal(tiles);
    const W = target.width,
        H = target.height;
    const id = rasterize(target, W, H);
    const leaves = quadtreeLeaves(buildIntegrals(id), W, H, { minCell, varThreshold });
    const F = tiles[0].F;

    const fc = new OffscreenCanvas(F, F);
    const fctx = fc.getContext("2d", { willReadFrequently: true });
    fctx.imageSmoothingQuality = "high";
    const feat = new Float32Array(F * F * 3);
    const gray = new Float32Array(F * F);

    const n = leaves.length;
    const rects = new Int32Array(n * 4);
    const idx = new Int32Array(n);
    const orient = new Int8Array(n);
    const contrast = new Float32Array(n);
    const blockMeans = new Float32Array(n * 3);
    const tileMeans = new Float32Array(n * 3);
    leaves.forEach(([x, y, w, h], i) => {
        const lf = leafFeature(fctx, target, x, y, w, h, F, feat, preserveTransparency);
        rects[i * 4] = x;
        rects[i * 4 + 1] = y;
        rects[i * 4 + 2] = w;
        rects[i * 4 + 3] = h;
        if (preserveTransparency && lf.alpha < ALPHA_SKIP) {
            idx[i] = -1; // mostly transparent block: stays transparent
            return;
        }
        for (let j = 0; j < gray.length; j++)
            gray[j] = 0.299 * feat[j * 3] + 0.587 * feat[j * 3 + 1] + 0.114 * feat[j * 3 + 2];
        const m = matchLeaf(gray, tiles);
        idx[i] = m.idx;
        orient[i] = m.orient;
        contrast[i] = m.s;
        blockMeans[i * 3] = lf.mean[0];
        blockMeans[i * 3 + 1] = lf.mean[1];
        blockMeans[i * 3 + 2] = lf.mean[2];
        tileMeans[i * 3] = tiles[m.idx].mean[0];
        tileMeans[i * 3 + 1] = tiles[m.idx].mean[1];
        tileMeans[i * 3 + 2] = tiles[m.idx].mean[2];
    });

    return { type: "fractal", width: W, height: H, rects, idx, orient, contrast, blockMeans, tileMeans };
}

/**
 * Render with orientation + intensity transform, at an arbitrary scale:
 * draw the tile (over its own mean color) with the matched orientation,
 * then remap pixels out = s·(pixel − drawnMean) + blockMean per channel.
 */
export function renderFractal(model, imgs, scale) {
    const { rects, idx, orient, contrast, blockMeans, tileMeans } = model;
    const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(model.width * scale)),
        Math.max(1, Math.round(model.height * scale)),
    );
    const ctx = canvas.getContext("2d");
    const oc = new OffscreenCanvas(1, 1);
    const octx = oc.getContext("2d", { willReadFrequently: true });

    const n = idx.length;
    for (let i = 0; i < n; i++) {
        if (idx[i] < 0) continue; // transparent block
        const lx = rects[i * 4],
            ly = rects[i * 4 + 1],
            lw = rects[i * 4 + 2],
            lh = rects[i * 4 + 3];
        const x0 = Math.round(lx * scale),
            y0 = Math.round(ly * scale);
        const w = Math.max(1, Math.round((lx + lw) * scale) - x0),
            h = Math.max(1, Math.round((ly + lh) * scale) - y0);

        const o = orient[i];
        const rot90 = o & 1; // odd rotations swap axes
        const rw = rot90 ? h : w,
            rh = rot90 ? w : h;
        oc.width = w;
        oc.height = h;
        octx.imageSmoothingQuality = "high";
        octx.save();
        octx.translate(w / 2, h / 2);
        // Negative: canvas rotate() is clockwise in screen coords, but the
        // orientation features use counterclockwise rot90 steps.
        octx.rotate((-(o & 3) * Math.PI) / 2);
        if (o & 4) octx.scale(-1, 1); // flip applies before rotation, matching orientIndex
        drawTile(octx, imgs.get(idx[i]), -rw / 2, -rh / 2, rw, rh, [
            tileMeans[i * 3],
            tileMeans[i * 3 + 1],
            tileMeans[i * 3 + 2],
        ]);
        octx.restore();

        const id = octx.getImageData(0, 0, w, h);
        const px = id.data;
        let dr = 0,
            dg = 0,
            db = 0; // mean of what was actually drawn
        for (let p = 0; p < px.length; p += 4) {
            dr += px[p];
            dg += px[p + 1];
            db += px[p + 2];
        }
        const np = px.length / 4;
        dr /= np;
        dg /= np;
        db /= np;
        const s = contrast[i];
        for (let p = 0; p < px.length; p += 4) {
            px[p] = s * (px[p] - dr) + blockMeans[i * 3];
            px[p + 1] = s * (px[p + 1] - dg) + blockMeans[i * 3 + 1];
            px[p + 2] = s * (px[p + 2] - db) + blockMeans[i * 3 + 2];
            px[p + 3] = 255;
        }
        ctx.putImageData(id, x0, y0);
    }
    return canvas;
}
