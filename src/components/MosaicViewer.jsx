import { useCallback, useEffect, useRef, useState } from "react";
import { tileThumbUrl } from "../mosaic/constants";
import { hitTest } from "../mosaic/hitTest";
import { LOG_MSG } from "../utils/debug";
import { tileKeyId } from "../utils/tileNames";
import { hexPath } from "../mosaic/algorithms/hex";
import "./MosaicViewer.css";

const HIGHLIGHT = "251, 191, 36"; // amber-400
const TOOLTIP_PREF_KEY = "dokimosaic-tooltip";

/**
 * Interactive mosaic view: the worker's high-quality render pans/zooms on a
 * canvas (full tile quality when zoomed all the way in), and hovering a
 * tile shows what it is.
 *
 * @param {Object} props
 * @param {Object} props.model - placement model (hit-testing geometry)
 * @param {ImageBitmap} props.hqBitmap - high-quality render of the mosaic
 * @param {string[]} props.tileKeys - manifest index -> CDN key
 * @param {Map<string, {name: string, artist: string}>|null} props.tileNames
 */
export default function MosaicViewer({ model, hqBitmap, tileKeys, tileNames }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const viewRef = useRef({ scale: 1, x: 0, y: 0, fitScale: 1 });
    const hoverRef = useRef(null);
    const pointersRef = useRef(new Map());
    const dragRef = useRef(null);
    const rafRef = useRef(0);
    const maskCacheRef = useRef(new Map());
    const firstDrawRef = useRef(false);
    const [tooltip, setTooltip] = useState(null); // {x, y, tileIdx}
    const [tooltipEnabled, setTooltipEnabled] = useState(() => localStorage.getItem(TOOLTIP_PREF_KEY) !== "off");
    const [, setViewVersion] = useState(0); // re-render zoom % readout

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !hqBitmap) return;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const view = viewRef.current;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(hqBitmap, view.x, view.y, model.width * view.scale, model.height * view.scale);

        const hover = hoverRef.current;
        if (hover) drawHighlight(ctx, view, model, hover.shape, maskCacheRef.current);
    }, [hqBitmap, model]);

    const scheduleDraw = useCallback(() => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            draw();
        });
    }, [draw]);

    const fit = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const cw = container.clientWidth,
            ch = container.clientHeight;
        const scale = Math.min(cw / model.width, ch / model.height);
        viewRef.current = {
            scale,
            fitScale: scale,
            x: (cw - model.width * scale) / 2,
            y: (ch - model.height * scale) / 2,
        };
        setViewVersion((v) => v + 1);
    }, [model]);

    // New mosaic: reset the view, clear caches, and time the first draw.
    useEffect(() => {
        maskCacheRef.current = new Map();
        hoverRef.current = null;
        setTooltip(null);
        firstDrawRef.current = false;
        fit();
        const t0 = performance.now();
        draw();
        if (!firstDrawRef.current) {
            firstDrawRef.current = true;
            LOG_MSG(`[dokimosaic] viewer first draw in ${(performance.now() - t0).toFixed(1)}ms`);
        }
    }, [fit, draw]);

    // Track container size: match the backing store to CSS pixels * dpr.
    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return undefined;
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.max(1, Math.round(container.clientWidth * dpr));
            canvas.height = Math.max(1, Math.round(container.clientHeight * dpr));
            scheduleDraw();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        return () => observer.disconnect();
    }, [scheduleDraw]);

    const zoomAt = useCallback(
        (cx, cy, factor) => {
            const view = viewRef.current;
            const maxScale = ((hqBitmap?.width || model.width) / model.width) * 8;
            const next = Math.min(maxScale, Math.max(view.fitScale * 0.25, view.scale * factor));
            const applied = next / view.scale;
            view.x = cx - (cx - view.x) * applied;
            view.y = cy - (cy - view.y) * applied;
            view.scale = next;
            setViewVersion((v) => v + 1);
            scheduleDraw();
        },
        [hqBitmap, model, scheduleDraw],
    );

    // Wheel zoom needs a non-passive listener to preventDefault page scroll.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0016));
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, [zoomAt]);

    const updateHover = (e) => {
        if (!tooltipEnabled) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const px = e.clientX - rect.left,
            py = e.clientY - rect.top;
        const view = viewRef.current;
        const hit = hitTest(model, (px - view.x) / view.scale, (py - view.y) / view.scale);
        hoverRef.current = hit;
        setTooltip(hit ? { x: px, y: py, tileIdx: hit.tileIdx } : null);
        scheduleDraw();
    };

    const clearHover = () => {
        if (!hoverRef.current) return;
        hoverRef.current = null;
        setTooltip(null);
        scheduleDraw();
    };

    const toggleTooltip = () => {
        const next = !tooltipEnabled;
        setTooltipEnabled(next);
        localStorage.setItem(TOOLTIP_PREF_KEY, next ? "on" : "off");
        if (!next) clearHover();
    };

    const onPointerDown = (e) => {
        canvasRef.current.setPointerCapture(e.pointerId);
        canvasRef.current.style.cursor = "grabbing";
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size === 1) {
            dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
        }
        clearHover();
    };

    const onPointerMove = (e) => {
        const pointers = pointersRef.current;
        if (pointers.has(e.pointerId)) {
            const prev = pointers.get(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {
                // Pinch: zoom around the midpoint by the distance ratio.
                const [a, b] = [...pointers.values()];
                const prevOther = a.x === e.clientX && a.y === e.clientY ? b : a;
                const distNow = Math.hypot(a.x - b.x, a.y - b.y);
                const distPrev = Math.hypot(prev.x - prevOther.x, prev.y - prevOther.y);
                if (distPrev > 0) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, distNow / distPrev);
                }
            } else if (dragRef.current) {
                const view = viewRef.current;
                view.x += e.clientX - dragRef.current.x;
                view.y += e.clientY - dragRef.current.y;
                if (Math.abs(e.clientX - dragRef.current.x) + Math.abs(e.clientY - dragRef.current.y) > 2) {
                    dragRef.current.moved = true;
                }
                dragRef.current.x = e.clientX;
                dragRef.current.y = e.clientY;
                scheduleDraw();
            }
            return;
        }
        if (e.pointerType === "mouse") updateHover(e);
    };

    const onPointerUp = (e) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size === 0) {
            dragRef.current = null;
            if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }
    };

    const view = viewRef.current;
    const zoomPercent = Math.round((view.scale / view.fitScale) * 100);
    const tooltipInfo = tooltip ? lookupTile(tooltip.tileIdx, tileKeys, tileNames) : null;

    return (
        <div className="mosaic-viewer" ref={containerRef}>
            <canvas
                ref={canvasRef}
                className="mosaic-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={clearHover}
            />
            <div className="mosaic-viewer-controls">
                <button
                    type="button"
                    className="mosaic-zoom-btn"
                    aria-label="Zoom out"
                    onClick={() => {
                        const c = containerRef.current;
                        zoomAt(c.clientWidth / 2, c.clientHeight / 2, 1 / 1.4);
                    }}
                >
                    −
                </button>
                <span className="mosaic-zoom-readout">{zoomPercent}%</span>
                <button
                    type="button"
                    className="mosaic-zoom-btn"
                    aria-label="Zoom in"
                    onClick={() => {
                        const c = containerRef.current;
                        zoomAt(c.clientWidth / 2, c.clientHeight / 2, 1.4);
                    }}
                >
                    +
                </button>
                <button
                    type="button"
                    className="mosaic-zoom-btn mosaic-zoom-reset"
                    aria-label="Reset view"
                    onClick={() => {
                        fit();
                        scheduleDraw();
                    }}
                >
                    Fit
                </button>
                <button
                    type="button"
                    className={`mosaic-zoom-btn mosaic-tooltip-toggle ${tooltipEnabled ? "active" : ""}`.trim()}
                    aria-pressed={tooltipEnabled}
                    aria-label={tooltipEnabled ? "Hide tile tooltips" : "Show tile tooltips"}
                    title={tooltipEnabled ? "Hide tile tooltips" : "Show tile tooltips"}
                    onClick={toggleTooltip}
                >
                    <InfoIcon />
                </button>
            </div>
            <div className="mosaic-viewer-hint">
                Scroll to zoom · drag to pan{tooltipEnabled ? " · hover a tile to identify it" : ""}
            </div>
            {tooltipEnabled && tooltip && tooltipInfo && (
                <div
                    className="mosaic-tooltip glass-panel"
                    style={{
                        left: Math.min(tooltip.x + 16, (containerRef.current?.clientWidth || 300) - 190),
                        top: Math.max(tooltip.y - 90, 8),
                    }}
                >
                    <img src={tooltipInfo.src} alt="" />
                    <div className="mosaic-tooltip-text">
                        <strong>{tooltipInfo.name}</strong>
                        {tooltipInfo.artist && <span>by {tooltipInfo.artist}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

const InfoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
    </svg>
);

function lookupTile(tileIdx, tileKeys, tileNames) {
    const key = tileKeys?.[tileIdx];
    if (!key) return null;
    const meta = tileNames?.get(tileKeyId(key));
    return {
        src: tileThumbUrl(key),
        name: meta?.name || tileKeyId(key),
        artist: meta?.artist && meta.artist !== "Unknown" ? meta.artist : "",
    };
}

/** Outline/tint the hovered piece in its exact shape. */
function drawHighlight(ctx, view, model, shape, maskCache) {
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    ctx.lineWidth = 2 / view.scale;
    ctx.strokeStyle = `rgba(${HIGHLIGHT}, 0.95)`;
    ctx.fillStyle = `rgba(${HIGHLIGHT}, 0.18)`;

    if (shape.kind === "rect") {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    } else if (shape.kind === "hex") {
        const path = hexPath(shape.w, shape.h);
        ctx.translate(shape.x, shape.y);
        ctx.fill(path);
        ctx.stroke(path);
    } else if (shape.kind === "sticker") {
        ctx.translate(shape.cx, shape.cy);
        ctx.rotate(shape.angle);
        ctx.fillRect(-shape.s / 2, -shape.s / 2, shape.s, shape.s);
        ctx.strokeRect(-shape.s / 2, -shape.s / 2, shape.s, shape.s);
    } else if (shape.kind === "label") {
        let mask = maskCache.get(shape.cell);
        if (!mask) {
            mask = buildLabelMask(model, shape.cell);
            maskCache.set(shape.cell, mask);
        }
        ctx.globalAlpha = 0.35;
        ctx.drawImage(mask, shape.x, shape.y, shape.w, shape.h);
        ctx.globalAlpha = 1;
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    }
    ctx.restore();
}

/** Tinted alpha mask of one label cell (at label resolution). */
function buildLabelMask(model, cell) {
    const { labels, box, lw } = model;
    const x0 = box[cell * 4],
        y0 = box[cell * 4 + 1];
    const bw = box[cell * 4 + 2] - x0 + 1,
        bh = box[cell * 4 + 3] - y0 + 1;
    const img = new ImageData(bw, bh);
    for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
            if (labels[(y0 + y) * lw + (x0 + x)] === cell) {
                const p = (y * bw + x) * 4;
                img.data[p] = 251;
                img.data[p + 1] = 191;
                img.data[p + 2] = 36;
                img.data[p + 3] = 255;
            }
        }
    const canvas = document.createElement("canvas");
    canvas.width = bw;
    canvas.height = bh;
    canvas.getContext("2d").putImageData(img, 0, 0);
    return canvas;
}
