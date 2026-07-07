import { ENGINES } from "./algorithms";
import { clampCanvasSize, TILE_NATIVE_SIZE } from "./constants";
import { loadManifest } from "./manifest";
import { workingSize } from "./raster";
import { fetchTiles } from "./tiles";

// Interactive renders cap at half the export area budget: they live on
// screen for the whole session, exports are transient.
const MAX_HQ_AREA = 32_000_000;

// Tile bitmaps persist across jobs, re-running with new options reuses downloads.
const tileCache = new Map();

// State of the most recent job, kept for export re-renders.
let job = null;

self.onmessage = async (e) => {
    const msg = e.data;
    try {
        if (msg.type === "process") {
            await handleProcess(msg);
        } else if (msg.type === "export") {
            await handleExport(msg);
        }
    } catch (err) {
        self.postMessage({ type: "error", jobId: msg.jobId, message: err?.message || String(err) });
    }
};

async function handleProcess({ jobId, algorithmId, params, bitmap, excludedKeys = [] }) {
    const engine = ENGINES[algorithmId];
    if (!engine) throw new Error(`Unknown algorithm: ${algorithmId}`);

    const t0 = performance.now();
    self.postMessage({ type: "progress", jobId, stage: "loading tiles manifest" });
    const allTiles = await loadManifest();
    const excluded = new Set(excludedKeys);
    const tiles = excluded.size ? allTiles.filter((t) => !excluded.has(t.key)) : allTiles;
    if (!tiles.length) {
        throw new Error("every tile is filtered out. Re-enable at least one tile and try again");
    }

    // Analyze at working resolution (longest side capped); keep the
    // original for export base layers.
    const ws = workingSize(bitmap.width, bitmap.height);
    const working =
        ws.width === bitmap.width
            ? bitmap
            : await createImageBitmap(bitmap, {
                  resizeWidth: ws.width,
                  resizeHeight: ws.height,
                  resizeQuality: "high",
              });

    self.postMessage({ type: "progress", jobId, stage: "matching tiles" });
    const tAnalyze0 = performance.now();
    const model = engine.analyze(working, tiles, params);
    const analyzeMs = performance.now() - tAnalyze0;

    self.postMessage({ type: "progress", jobId, stage: "downloading tiles" });
    const tFetch0 = performance.now();
    const imgs = await fetchTiles(model.idx, tiles, tileCache);
    const fetchMs = performance.now() - tFetch0;

    // Interactive render: scale so the smallest cell reaches native tile
    // resolution, within the canvas area budget.
    self.postMessage({ type: "progress", jobId, stage: "rendering" });
    const tRender0 = performance.now();
    let hqScale = Math.max(1, TILE_NATIVE_SIZE / engine.minCell(model));
    const areaScale = Math.sqrt(MAX_HQ_AREA / (model.width * model.height));
    hqScale = Math.min(hqScale, areaScale);
    const clamped = clampCanvasSize(model.width * hqScale, model.height * hqScale);
    hqScale = clamped.width / model.width;
    const canvas = engine.render(model, imgs, hqScale, working);
    const hqBitmap = canvas.transferToImageBitmap();
    const renderMs = performance.now() - tRender0;

    if (job && job.target !== bitmap) {
        job.target.close?.();
        if (job.working !== job.target) job.working.close?.();
    }
    job = { jobId, algorithmId, model, imgs, target: bitmap, working };

    self.postMessage(
        {
            type: "done",
            jobId,
            model,
            hqBitmap,
            hqScale,
            tileKeys: tiles.map((t) => t.key),
            distinctTiles: new Set(Array.from(model.idx).filter((i) => i >= 0)).size,
            timings: { analyzeMs, fetchMs, renderMs, totalMs: performance.now() - t0 },
        },
        [hqBitmap],
    );
}

async function handleExport({ jobId, scale }) {
    if (!job) throw new Error("Nothing to export yet");
    const engine = ENGINES[job.algorithmId];
    const { model, imgs, target, working } = job;

    // 1x export matches the original target resolution (the model may crop
    // a sub-cell remainder, mirroring the reference implementations).
    const t0 = performance.now();
    const baseScale = (target.width / working.width) * scale;
    const clamped = clampCanvasSize(model.width * baseScale, model.height * baseScale);
    const renderScale = clamped.width / model.width;
    const canvas = engine.render(model, imgs, renderScale, target);
    const renderMs = performance.now() - t0;

    const tEncode0 = performance.now();
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const encodeMs = performance.now() - tEncode0;

    self.postMessage({
        type: "exported",
        jobId,
        blob,
        width: canvas.width,
        height: canvas.height,
        clamped: clamped.clamped,
        timings: { renderMs, encodeMs },
    });
}
