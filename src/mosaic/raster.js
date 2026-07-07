import { MAX_ANALYSIS_SIDE } from "./constants";

/**
 * Downscale anything drawable to (w, h) and return its ImageData.
 * The GPU's box filtering does the averaging: rasterize the target to
 * (cols, rows) and every pixel IS a cell's mean color; rasterize to
 * (cols*8, rows*8) and every 8x8 block is a cell's feature patch.
 */
export function rasterize(src, w, h) {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

/**
 * Working size for analysis: the target's dimensions scaled so the longest
 * side is at most MAX_ANALYSIS_SIDE. Quality is unaffected; compute cost is.
 */
export function workingSize(width, height) {
    const side = Math.max(width, height);
    if (side <= MAX_ANALYSIS_SIDE) return { width, height };
    const s = MAX_ANALYSIS_SIDE / side;
    return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}
