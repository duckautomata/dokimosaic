import Papa from "papaparse";
import { cdn } from "../config";
import { LOG_ERROR } from "./debug";

/**
 * Tile identity lookup for hover tooltips. The tile manifest keys are CDN
 * paths like "dokimotes/<image_id>.png"; the dokimotes emote archive
 * publishes emotes.csv mapping image_id -> name/artist.
 *
 * Returns a Map keyed by image_id (tile key basename without extension)
 * with { name, artist }. Failure degrades gracefully to an empty map,
 * tooltips then fall back to the raw key.
 */
let cached = null;

export async function loadTileNames() {
    if (!cached) {
        cached = (async () => {
            const res = await fetch(`${cdn}/dokimotes/emotes.csv`);
            if (!res.ok) throw new Error(`Failed to fetch emotes.csv (${res.status})`);
            const text = await res.text();
            const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
            const map = new Map();
            for (const row of data) {
                if (row.image_id) {
                    map.set(row.image_id, { name: row.name || row.emote_id || row.image_id, artist: row.artist || "" });
                }
            }
            return map;
        })().catch((err) => {
            LOG_ERROR("Error loading tile names:", err);
            cached = null; // allow retry next call
            return new Map();
        });
    }
    return cached;
}

/** "dokimotes/3YMxyz.png" -> "3YMxyz" */
export function tileKeyId(key) {
    const base = key.slice(key.lastIndexOf("/") + 1);
    const dot = base.lastIndexOf(".");
    return dot === -1 ? base : base.slice(0, dot);
}
