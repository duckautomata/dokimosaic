/**
 * UI metadata for every mosaic algorithm: display info plus parameter
 * definitions the options panel renders generically. Pure data, safe to
 * import from React components without dragging in canvas/worker code.
 *
 * Param kinds: "range" (slider with min/max/step) and "int" (number input).
 */

const variety = {
    key: "variety",
    label: "Variety",
    kind: "range",
    min: 1,
    max: 8,
    step: 1,
    default: 3,
    hint: "Pick among the top-k matches; 1 always takes the best match",
};

const seed = {
    key: "seed",
    label: "Seed",
    kind: "int",
    min: 0,
    max: 999999,
    default: 0,
    hint: "Same image + same seed reproduces the same mosaic",
};

const repeatPenalty = {
    key: "repeatPenalty",
    label: "Repeat penalty",
    kind: "range",
    min: 0,
    max: 1,
    step: 0.05,
    default: 0,
    hint: "Discourages the same tile from repeating across the mosaic",
};

export const ALGORITHMS = [
    {
        id: "grid",
        name: "Grid",
        tagline: "Classic square mosaic",
        description:
            "Divide the image into equal squares and replace each with the tile whose average color is closest. " +
            "Honest, chunky mosaic. Individual tiles stay perfectly readable.",
        params: [
            {
                key: "cells",
                label: "Cells across",
                kind: "range",
                min: 10,
                max: 200,
                step: 1,
                default: 50,
                hint: "More cells = finer mosaic, more tile downloads",
            },
            variety,
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "blend",
        name: "Blend",
        tagline: "Most faithful to the target",
        description:
            "Square grid with sub-image matching (tiles match edges inside each cell) and a color-blending pass " +
            "that pulls the mosaic toward the target's exact palette.",
        params: [
            {
                key: "cells",
                label: "Cells across",
                kind: "range",
                min: 10,
                max: 200,
                step: 1,
                default: 50,
                hint: "More cells = finer mosaic, more tile downloads",
            },
            variety,
            {
                key: "blendStrength",
                label: "Blend strength",
                kind: "range",
                min: 0,
                max: 1,
                step: 0.05,
                default: 0.55,
                hint: "0 = raw tiles, 1 = every cell exactly matches the target color",
            },
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "dither",
        name: "Dither",
        tagline: "Best color balance",
        description:
            "Square grid with Floyd–Steinberg error diffusion: color errors spread to neighboring cells so " +
            "regions average out to the true target color. Fully deterministic.",
        params: [
            {
                key: "cells",
                label: "Cells across",
                kind: "range",
                min: 10,
                max: 200,
                step: 1,
                default: 50,
                hint: "More cells = finer mosaic, more tile downloads",
            },
        ],
    },
    {
        id: "quadtree",
        name: "Quadtree",
        tagline: "Tile sizes adapt to detail",
        description:
            "Detailed areas get dense small tiles, calm areas get big bold ones. A magazine-cover mosaic with " +
            "visual hierarchy.",
        params: [
            {
                key: "minCell",
                label: "Smallest tile (px)",
                kind: "range",
                min: 8,
                max: 64,
                step: 1,
                default: 16,
                hint: "Lower = more detail, more cells",
            },
            {
                key: "varThreshold",
                label: "Split threshold",
                kind: "range",
                min: 4,
                max: 50,
                step: 1,
                default: 18,
                hint: "Lower splits more aggressively into small tiles",
            },
            variety,
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "voronoi",
        name: "Voronoi",
        tagline: "Organic jigsaw pieces",
        description:
            "Seeds scatter across the image (denser where there's detail) and every pixel joins its nearest seed, " +
            "forming hand-cut jigsaw cells with darkened seams.",
        params: [
            {
                key: "points",
                label: "Pieces",
                kind: "range",
                min: 100,
                max: 2000,
                step: 50,
                default: 700,
                hint: "Number of jigsaw pieces",
            },
            {
                key: "lloydIters",
                label: "Relaxation",
                kind: "range",
                min: 0,
                max: 5,
                step: 1,
                default: 2,
                hint: "More = rounder, more uniform pieces; 0 = raw, spiky cells",
            },
            {
                key: "seam",
                label: "Seam darkness",
                kind: "range",
                min: 0.5,
                max: 1,
                step: 0.01,
                default: 0.72,
                hint: "Boundary darkening; 1 = no seams",
            },
            variety,
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "superpixel",
        name: "Superpixel",
        tagline: "Cells hug image edges",
        description:
            "SLIC clustering makes cell walls settle exactly where the image's colors change, so tile boundaries " +
            "trace object contours. Portraits and clear silhouettes shine.",
        params: [
            {
                key: "points",
                label: "Segments",
                kind: "range",
                min: 100,
                max: 2000,
                step: 50,
                default: 700,
                hint: "Requested segment count",
            },
            {
                key: "compactness",
                label: "Compactness",
                kind: "range",
                min: 5,
                max: 60,
                step: 1,
                default: 25,
                hint: "Lower = snakier cells tracing edges; higher = round blobs",
            },
            {
                key: "iters",
                label: "Refinement",
                kind: "range",
                min: 1,
                max: 10,
                step: 1,
                default: 5,
                hint: "SLIC refinement rounds; gains flatten after ~5",
            },
            variety,
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "hex",
        name: "Hex",
        tagline: "Honeycomb",
        description:
            "Similar to grid but in a honeycomb layout. Clearly geometric without the " +
            "spreadsheet feel of a square grid.",
        params: [
            {
                key: "cells",
                label: "Hexagons across",
                kind: "range",
                min: 10,
                max: 200,
                step: 1,
                default: 40,
                hint: "More hexagons = finer mosaic",
            },
            variety,
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "scatter",
        name: "Scatter",
        tagline: "Overlapping sticker collage",
        description:
            "Tiles are stamped like stickers. Random positions and rotations, big to small, over a blurred copy " +
            "of the target.",
        params: [
            {
                key: "count",
                label: "Stickers",
                kind: "range",
                min: 200,
                max: 4000,
                step: 100,
                default: 1200,
                hint: "Total stickers across all size tiers",
            },
            {
                key: "maxAngle",
                label: "Max rotation (°)",
                kind: "range",
                min: 0,
                max: 90,
                step: 5,
                default: 35,
                hint: "0 = axis-aligned stickers",
            },
            { ...variety, default: 4 },
            repeatPenalty,
            seed,
        ],
    },
    {
        id: "fractal",
        name: "Fractal",
        tagline: "Recolored texture transfer",
        description:
            "Tiles match by internal structure (any rotation or flip) and are recolored to the target's palette. The target's shading drawn in the strokes of the tiles.",
        params: [
            {
                key: "minCell",
                label: "Smallest block (px)",
                kind: "range",
                min: 12,
                max: 64,
                step: 1,
                default: 20,
                hint: "Lower = more detail, more blocks",
            },
            {
                key: "varThreshold",
                label: "Split threshold",
                kind: "range",
                min: 4,
                max: 50,
                step: 1,
                default: 14,
                hint: "Lower splits more aggressively into small blocks",
            },
        ],
    },
];

export const ALGORITHM_MAP = new Map(ALGORITHMS.map((a) => [a.id, a]));

/**
 * Options shared by every algorithm, rendered after the per-algorithm
 * params and carried over when switching algorithms.
 */
export const COMMON_PARAMS = [
    {
        key: "preserveTransparency",
        label: "Preserve transparency",
        kind: "bool",
        default: true,
        hint: "Transparent areas of the image stay transparent instead of being tiled as black",
    },
];

/** Default parameter values for an algorithm id (including common options). */
export function defaultParams(algorithmId) {
    const algo = ALGORITHM_MAP.get(algorithmId);
    if (!algo) return {};
    return Object.fromEntries([...algo.params, ...COMMON_PARAMS].map((p) => [p.key, p.default]));
}
