export const CDN_BASE = "https://content.duck-automata.com/";
export const MANIFEST_URL = "https://content.duck-automata.com/dokimosaic/tiles.json";

// Mosaics render from previews; tooltips use thumbnails.
function tileVariantUrl(key, suffix) {
    const dot = key.lastIndexOf(".");
    const slash = key.lastIndexOf("/");
    const stem = dot > slash ? key.slice(0, dot) : key;
    return CDN_BASE + stem + suffix;
}

/** Full-resolution preview webp for a manifest tile key. */
export const tilePreviewUrl = (key) => tileVariantUrl(key, "_p.webp");

/** Small thumbnail webp for a manifest tile key. */
export const tileThumbUrl = (key) => tileVariantUrl(key, "_t.webp");

/** The original upload (fallback if a variant is missing). */
export const tileOriginalUrl = (key) => CDN_BASE + key;

// Longest side the target is downscaled to before analysis. Quality is
// unaffected (cells are averaged anyway); compute cost is not.
export const MAX_ANALYSIS_SIDE = 1600;

// When preserving transparency, cells/regions whose mean alpha (0-255)
// falls below this stay transparent instead of receiving a tile.
export const ALPHA_SKIP = 128;

// Native tile resolution on the CDN is 96x96. The interactive render aims
// for this many pixels per smallest cell so zooming in shows tiles at full
// quality.
export const TILE_NATIVE_SIZE = 96;

// Canvas safety limits for HQ/interactive and export renders. Kept well
// under browser maximums (Chrome ~268MP, Safari lower).
export const MAX_CANVAS_SIDE = 16000;
export const MAX_CANVAS_AREA = 64_000_000;

/**
 * Clamp requested output dimensions to the canvas safety limits,
 * preserving aspect ratio. Returns { width, height, clamped }.
 */
export function clampCanvasSize(width, height) {
    let scale = 1;
    const side = Math.max(width, height);
    if (side * scale > MAX_CANVAS_SIDE) {
        scale = MAX_CANVAS_SIDE / side;
    }
    if (width * height * scale * scale > MAX_CANVAS_AREA) {
        scale = Math.sqrt(MAX_CANVAS_AREA / (width * height));
    }
    if (scale >= 1) {
        return { width: Math.round(width), height: Math.round(height), clamped: false };
    }
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        clamped: true,
    };
}
