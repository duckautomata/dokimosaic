import { analyzeBlend, renderBlend } from "./blend";
import { analyzeDither } from "./dither";
import { analyzeFractal, renderFractal } from "./fractal";
import { analyzeGrid, renderGrid } from "./grid";
import { analyzeHex, renderHex } from "./hex";
import { renderLabelMosaic } from "./labelRender";
import { analyzeQuadtree, renderQuadtree } from "./quadtree";
import { analyzeScatter, renderScatter } from "./scatter";
import { analyzeSuperpixel } from "./superpixel";
import { analyzeVoronoi } from "./voronoi";

/**
 * Engine registry. Every engine implements:
 *   analyze(targetBitmap, tiles, params) -> model   (serializable)
 *   render(model, imgs, scale, targetBitmap) -> OffscreenCanvas
 *   minCell(model) -> smallest cell size in model coords (drives the
 *     interactive render scale so zooming reaches native tile quality)
 */
export const ENGINES = {
    grid: {
        analyze: analyzeGrid,
        render: (model, imgs, scale) => renderGrid(model, imgs, scale),
        minCell: (m) => m.cell,
    },
    blend: {
        analyze: analyzeBlend,
        render: (model, imgs, scale) => renderBlend(model, imgs, scale),
        minCell: (m) => m.cell,
    },
    dither: {
        analyze: analyzeDither,
        render: (model, imgs, scale) => renderGrid(model, imgs, scale),
        minCell: (m) => m.cell,
    },
    quadtree: {
        analyze: analyzeQuadtree,
        render: (model, imgs, scale) => renderQuadtree(model, imgs, scale),
        minCell: minLeaf,
    },
    voronoi: {
        analyze: analyzeVoronoi,
        render: (model, imgs, scale, target) => renderLabelMosaic(model, imgs, scale, target),
        minCell: labelSpacing,
    },
    superpixel: {
        analyze: analyzeSuperpixel,
        render: (model, imgs, scale, target) => renderLabelMosaic(model, imgs, scale, target),
        minCell: labelSpacing,
    },
    hex: {
        analyze: analyzeHex,
        render: (model, imgs, scale, target) => renderHex(model, imgs, scale, target),
        minCell: (m) => m.hexW,
    },
    scatter: {
        analyze: analyzeScatter,
        render: (model, imgs, scale, target) => renderScatter(model, imgs, scale, target),
        minCell: minSticker,
    },
    fractal: {
        analyze: analyzeFractal,
        render: (model, imgs, scale) => renderFractal(model, imgs, scale),
        minCell: minLeaf,
    },
};

function minLeaf(model) {
    let min = Infinity;
    const { rects } = model;
    for (let i = 0; i < rects.length; i += 4) {
        const s = Math.min(rects[i + 2], rects[i + 3]);
        if (s < min) min = s;
    }
    return Number.isFinite(min) ? min : 16;
}

function minSticker(model) {
    let min = Infinity;
    const { data } = model;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 2] < min) min = data[i + 2];
    }
    return Number.isFinite(min) ? min : 16;
}

// Typical cell diameter for label-map models: cells live at half
// resolution, so double the average label-space spacing.
function labelSpacing(model) {
    let active = 0;
    for (let s = 0; s < model.idx.length; s++) if (model.idx[s] >= 0) active++;
    return 2 * Math.sqrt((model.lw * model.lh) / Math.max(1, active));
}
