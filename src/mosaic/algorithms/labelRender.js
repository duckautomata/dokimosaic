import { drawTile } from "../tiles";

/**
 * Shared analysis step for label-map algorithms (voronoi/superpixel):
 * per-cell mean colors, alpha coverage, and bounding boxes in one pass over
 * the label map. Returns { means: Float32Array(n*3), counts, box, alphas }
 * with box = [minX, minY, maxX, maxY] and alphas = mean alpha (0-255) per
 * cell.
 */
export function labelStats(labels, id, n) {
    const { width: lw, height: lh, data } = id;
    const sums = new Float64Array(n * 4);
    const alphaSums = new Float64Array(n);
    const box = new Int32Array(n * 4);
    for (let s = 0; s < n; s++) {
        box[s * 4] = 1 << 30;
        box[s * 4 + 1] = 1 << 30;
        box[s * 4 + 2] = -1;
        box[s * 4 + 3] = -1;
    }
    for (let y = 0; y < lh; y++)
        for (let x = 0; x < lw; x++) {
            const s = labels[y * lw + x];
            if (s < 0) continue;
            const p = (y * lw + x) * 4;
            sums[s * 4] += data[p];
            sums[s * 4 + 1] += data[p + 1];
            sums[s * 4 + 2] += data[p + 2];
            sums[s * 4 + 3]++;
            alphaSums[s] += data[p + 3];
            if (x < box[s * 4]) box[s * 4] = x;
            if (y < box[s * 4 + 1]) box[s * 4 + 1] = y;
            if (x > box[s * 4 + 2]) box[s * 4 + 2] = x;
            if (y > box[s * 4 + 3]) box[s * 4 + 3] = y;
        }
    const means = new Float32Array(n * 3);
    const counts = new Float64Array(n);
    const alphas = new Float32Array(n);
    for (let s = 0; s < n; s++) {
        const c = sums[s * 4 + 3] || 1;
        means[s * 3] = sums[s * 4] / c;
        means[s * 3 + 1] = sums[s * 4 + 1] / c;
        means[s * 3 + 2] = sums[s * 4 + 2] / c;
        counts[s] = sums[s * 4 + 3];
        alphas[s] = alphaSums[s] / c;
    }
    return { means, counts, box, alphas };
}

/**
 * Render a label-map model ({ lw, lh, labels, box, means, idx, seam }) at
 * an arbitrary scale. Instead of composing at label resolution and
 * upscaling (which softens tiles), each cell's tile is drawn sharp at
 * output resolution and clipped by its upscaled alpha mask. Masks are
 * dilated by a sub-pixel pad so adjacent cells overlap with no seams; for
 * fully covered mosaics the target additionally draws first as a backstop.
 * When transparency skipped some cells the backstop is dropped — it would
 * leak the original image through the uncovered areas. No pixel readback
 * of CDN tiles is needed.
 */
export function renderLabelMosaic(model, imgs, scale, target) {
    const { lw, lh, labels, box, means, idx, seam = 1 } = model;
    const outW = Math.max(1, Math.round(model.width * scale));
    const outH = Math.max(1, Math.round(model.height * scale));
    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    if (!model.hasTransparentCells) {
        ctx.drawImage(target, 0, 0, outW, outH); // backstop behind mask edges
    }

    const sx = outW / lw,
        sy = outH / lh;
    const maskCanvas = new OffscreenCanvas(1, 1);
    const maskCtx = maskCanvas.getContext("2d");
    const tileCanvas = new OffscreenCanvas(1, 1);
    const tileCtx = tileCanvas.getContext("2d");

    const n = idx.length;
    for (let s = 0; s < n; s++) {
        if (idx[s] < 0) continue;
        const x0 = box[s * 4],
            y0 = box[s * 4 + 1],
            x1 = box[s * 4 + 2],
            y1 = box[s * 4 + 3];
        if (x1 < 0) continue; // empty cell
        const bw = x1 - x0 + 1,
            bh = y1 - y0 + 1;

        // Alpha mask of this cell at label resolution.
        const mask = new ImageData(bw, bh);
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                if (labels[y * lw + x] === s) mask.data[((y - y0) * bw + (x - x0)) * 4 + 3] = 255;
            }
        maskCanvas.width = bw;
        maskCanvas.height = bh;
        maskCtx.putImageData(mask, 0, 0);

        // Output-resolution rect covering the box.
        const rx0 = Math.floor(x0 * sx),
            ry0 = Math.floor(y0 * sy);
        const rw = Math.max(1, Math.ceil((x1 + 1) * sx) - rx0),
            rh = Math.max(1, Math.ceil((y1 + 1) * sy) - ry0);
        tileCanvas.width = rw;
        tileCanvas.height = rh;
        tileCtx.imageSmoothingQuality = "high";
        drawTile(tileCtx, imgs.get(idx[s]), 0, 0, rw, rh, [means[s * 3], means[s * 3 + 1], means[s * 3 + 2]]);
        tileCtx.globalCompositeOperation = "destination-in";
        // Slightly dilate the mask so neighboring cells' soft edges overlap
        // instead of leaving hairline gaps.
        const pad = 0.75;
        tileCtx.drawImage(maskCanvas, 0, 0, bw, bh, -pad, -pad, rw + 2 * pad, rh + 2 * pad);
        tileCtx.globalCompositeOperation = "source-over";

        ctx.drawImage(tileCanvas, rx0, ry0);
    }

    // Seams: darken pixels whose left or top neighbor is another cell
    // Overlaying black at alpha (1 - seam) equals multiplying by seam.
    // Pixels belonging to transparent (skipped) cells get no seam, so no
    // lines float in empty space.
    if (seam < 1) {
        const overlay = new ImageData(lw, lh);
        const a = Math.round((1 - seam) * 255);
        for (let y = 1; y < lh; y++)
            for (let x = 1; x < lw; x++) {
                const i = y * lw + x;
                const cell = labels[i];
                if (cell < 0 || idx[cell] < 0) continue;
                if (cell !== labels[i - 1] || cell !== labels[i - lw]) {
                    overlay.data[i * 4 + 3] = a;
                }
            }
        const oc = new OffscreenCanvas(lw, lh);
        oc.getContext("2d").putImageData(overlay, 0, 0);
        ctx.drawImage(oc, 0, 0, outW, outH);
    }
    return canvas;
}
