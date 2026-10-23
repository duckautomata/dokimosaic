/**
 * Tile palettes: whose emotes a mosaic is built from. A tile belongs to the
 * palette whose prefix starts its manifest key ("dokimotes/<image_id>.png");
 * tiles under any other prefix belong to no palette and are always used.
 *
 * Pure apart from the storage helpers, so the worker can import it too.
 */
export const PALETTES = [
    { id: "doki", label: "Doki", prefix: "dokimotes" },
    { id: "mint", label: "Mint", prefix: "mintomotes" },
];

/** Selection that uses every palette. */
export const ALL_PALETTES = "both";
export const DEFAULT_PALETTE = "doki";

const STORAGE_KEY = "dokimosaic-palette";
const PALETTE_IDS = PALETTES.map((p) => p.id);

/** Palette id for a manifest tile key, or null when its prefix matches no palette. */
export function tilePalette(key) {
    const slash = key.indexOf("/");
    if (slash === -1) return null;
    const prefix = key.slice(0, slash);
    return PALETTES.find((p) => p.prefix === prefix)?.id ?? null;
}

/** Ids of the palettes with at least one tile among these keys, in PALETTES order. */
export function presentPalettes(keys) {
    const found = new Set(keys.map(tilePalette));
    return PALETTE_IDS.filter((id) => found.has(id));
}

/** The picker only appears once the manifest mixes tiles from two or more palettes. */
export const showPalettePicker = (present) => present.length >= 2;

/**
 * Resolve the viewer's choice against the palettes the manifest actually
 * has: a palette id, or ALL_PALETTES for every tile. With the picker hidden
 * nothing is filtered by palette; a choice with no tiles falls back to the
 * default palette.
 */
export function resolvePalette(choice, present) {
    if (!showPalettePicker(present) || choice === ALL_PALETTES) return ALL_PALETTES;
    if (present.includes(choice)) return choice;
    return present.includes(DEFAULT_PALETTE) ? DEFAULT_PALETTE : ALL_PALETTES;
}

/** Whether a tile is used under a resolved selection (unknown prefixes always are). */
export function inPalette(key, selection) {
    if (selection === ALL_PALETTES) return true;
    const palette = tilePalette(key);
    return palette === null || palette === selection;
}

/**
 * Keys the mosaic must not use: tiles from unselected palettes plus the
 * viewer's own tile filter exclusions.
 * @param {string[]} keys - every manifest key
 * @param {string} choice - the viewer's palette choice (resolved here)
 * @param {Iterable<string>} userExcluded - tile filter exclusions
 * @returns {Set<string>}
 */
export function effectiveExclusion(keys, choice, userExcluded) {
    const selection = resolvePalette(choice, presentPalettes(keys));
    const excluded = new Set(userExcluded);
    for (const key of keys) {
        if (!inPalette(key, selection)) excluded.add(key);
    }
    return excluded;
}

/**
 * Apply a tile filter change that only covers the tiles it lists:
 * exclusions for unlisted tiles (other palettes) are kept as they were.
 * @param {Set<string>} excluded - every exclusion so far
 * @param {string[]} listedKeys - tiles the filter showed
 * @param {Set<string>} next - the filter's new exclusions among those tiles
 */
export function replaceListedExclusions(excluded, listedKeys, next) {
    const listed = new Set(listedKeys);
    const merged = new Set([...excluded].filter((key) => !listed.has(key)));
    for (const key of next) merged.add(key);
    return merged;
}

/** Picker options ({id, label}), empty while the picker is hidden. */
export function paletteOptions(present) {
    if (!showPalettePicker(present)) return [];
    return [
        ...PALETTES.filter((p) => present.includes(p.id)).map(({ id, label }) => ({ id, label })),
        { id: ALL_PALETTES, label: "Both" },
    ];
}

/**
 * Labels of the palettes a mosaic draws from, for copy. Before the manifest
 * loads (nothing present yet) this follows the viewer's choice.
 */
export function paletteLabels(choice, present) {
    const ids = present.length ? present : PALETTE_IDS;
    const selection = resolvePalette(choice, ids);
    return PALETTES.filter((p) => ids.includes(p.id) && (selection === ALL_PALETTES || selection === p.id)).map(
        (p) => p.label,
    );
}

/** The viewer's remembered choice; the default when unset, unknown or storage is unavailable. */
export function readStoredPalette() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === ALL_PALETTES || PALETTE_IDS.includes(stored)) return stored;
    } catch {
        // Storage blocked (private mode, sandboxed frame): use the default.
    }
    return DEFAULT_PALETTE;
}

/** Remember the viewer's choice; failing to store it only loses it on reload. */
export function storePalette(choice) {
    try {
        localStorage.setItem(STORAGE_KEY, choice);
    } catch {
        // Storage blocked: the choice still applies for this visit.
    }
}
