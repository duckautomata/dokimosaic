import { useState } from "react";
import { tileThumbUrl } from "../mosaic/constants";
import "./TileFilter.css";

/**
 * Choose which emote tiles the mosaic may use. Every tile is enabled by
 * default; click a tile to exclude it (e.g. one emote keeps winning cells
 * it shouldn't). Reset re-enables everything.
 *
 * @param {Object} props
 * @param {{key: string, name: string}[]} props.tiles - full tile library
 * @param {Set<string>} props.excluded - keys currently excluded
 * @param {(excluded: Set<string>) => void} props.onChange
 * @param {boolean} props.disabled - true while a mosaic is processing
 */
export default function TileFilter({ tiles, excluded, onChange, disabled }) {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState("");

    const usedCount = tiles.length - excluded.size;
    const query = search.trim().toLowerCase();
    const visible = query ? tiles.filter((t) => t.name.toLowerCase().includes(query)) : tiles;

    const toggle = (key) => {
        const next = new Set(excluded);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange(next);
    };

    return (
        <div className="tile-filter">
            <button
                type="button"
                className="tile-filter-header"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
            >
                <span className="home-card-caption tile-filter-caption">Tile filter</span>
                <span className="tile-filter-summary">
                    <span className={`tile-filter-count ${excluded.size ? "filtered" : ""}`.trim()}>
                        {usedCount} / {tiles.length} tiles
                    </span>
                    <span className="tile-filter-chevron">{expanded ? "▲" : "▼"}</span>
                </span>
            </button>

            {expanded && (
                <div className="tile-filter-body">
                    <p className="tile-filter-hint">
                        Click a tile to exclude it from the mosaic. All tiles are used by default.
                    </p>
                    <div className="tile-filter-controls">
                        <input
                            type="search"
                            className="tile-filter-search"
                            placeholder="Search tiles…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Search tiles"
                        />
                        <button
                            type="button"
                            className="secondary-btn tile-filter-reset"
                            onClick={() => onChange(usedCount > 0 ? new Set(tiles.map((t) => t.key)) : new Set())}
                            disabled={disabled}
                            title={
                                usedCount > 0
                                    ? "Exclude every tile, then re-enable just the ones you want"
                                    : "Re-enable every tile"
                            }
                        >
                            {usedCount > 0 ? "Disable all" : "Enable all"}
                        </button>
                        <button
                            type="button"
                            className="secondary-btn tile-filter-reset"
                            onClick={() => onChange(new Set())}
                            disabled={disabled || excluded.size === 0}
                        >
                            Reset
                        </button>
                    </div>
                    {usedCount === 0 && (
                        <div className="status-box error">
                            Every tile is excluded. Re-enable at least one to create a mosaic.
                        </div>
                    )}
                    <div className="tile-filter-grid" role="group" aria-label="Tiles to use">
                        {visible.map((t) => {
                            const isExcluded = excluded.has(t.key);
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    className={`tile-filter-tile ${isExcluded ? "excluded" : ""}`.trim()}
                                    onClick={() => toggle(t.key)}
                                    disabled={disabled}
                                    aria-pressed={!isExcluded}
                                    title={isExcluded ? `${t.name} (excluded)` : t.name}
                                >
                                    <img src={tileThumbUrl(t.key)} alt={t.name} decoding="async" />
                                </button>
                            );
                        })}
                        {visible.length === 0 && (
                            <span className="tile-filter-empty">No tiles match &quot;{search}&quot;</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
