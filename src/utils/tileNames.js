import Papa from "papaparse";
import { cdn } from "../config";
import { PALETTES } from "../mosaic/palettes";
import { LOG_ERROR } from "./debug";

/**
 * Tile identity lookup for hover tooltips. The tile manifest keys are CDN
 * paths like "dokimotes/<image_id>.png"; each palette's emote archive
 * publishes <prefix>/emotes.csv mapping image_id -> name/artist.
 *
 * Returns a Map keyed by image_id (tile key basename without extension)
 * with { name, artist }, merged across every palette. A CSV that fails to
 * load only drops its own names (tooltips then fall back to the raw key)
 * and is retried on the next call; loaded ones stay cached.
 */
const cached = new Map(); // palette prefix -> Promise<Map>

function loadPaletteNames(prefix) {
    if (!cached.has(prefix)) {
        cached.set(
            prefix,
            (async () => {
                const res = await fetch(`${cdn}/${prefix}/emotes.csv`);
                if (!res.ok) throw new Error(`Failed to fetch ${prefix}/emotes.csv (${res.status})`);
                const text = await res.text();
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                const map = new Map();
                for (const row of data) {
                    if (row.image_id) {
                        map.set(row.image_id, {
                            name: row.name || row.emote_id || row.image_id,
                            artist: row.artist || "",
                        });
                    }
                }
                return map;
            })().catch((err) => {
                LOG_ERROR("Error loading tile names:", err);
                cached.delete(prefix); // allow retry next call
                return new Map();
            }),
        );
    }
    return cached.get(prefix);
}

export async function loadTileNames() {
    const maps = await Promise.all(PALETTES.map((p) => loadPaletteNames(p.prefix)));
    return new Map(maps.flatMap((map) => [...map]));
}

/** "dokimotes/3YMxyz.png" -> "3YMxyz" */
export function tileKeyId(key) {
    const base = key.slice(key.lastIndexOf("/") + 1);
    const dot = base.lastIndexOf(".");
    return dot === -1 ? base : base.slice(0, dot);
}
