import { useCallback, useEffect, useRef, useState } from "react";
import { LOG_ERROR, LOG_MSG } from "../utils/debug";

/**
 * Owns the mosaic Web Worker: process / export / cancel. Cancel terminates
 * the worker (the only way to stop synchronous pixel math) and a fresh one
 * spawns on the next job. The source bitmap is structured-cloned to the
 * worker, so the caller keeps its copy for re-runs.
 */
export function useMosaicWorker() {
    const workerRef = useRef(null);
    const jobIdRef = useRef(0);
    const exportsRef = useRef(new Map()); // jobId -> {resolve, reject}
    const [status, setStatus] = useState("idle"); // idle | processing | done | error
    const [stage, setStage] = useState("");
    const [startedAt, setStartedAt] = useState(0);
    const [result, setResult] = useState(null); // {model, hqBitmap, hqScale, timings, distinctTiles}
    const [error, setError] = useState(null);

    const getWorker = useCallback(() => {
        if (!workerRef.current) {
            const worker = new Worker(new URL("./mosaicWorker.js", import.meta.url), { type: "module" });
            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === "progress") {
                    if (msg.jobId === jobIdRef.current) setStage(msg.stage);
                } else if (msg.type === "done") {
                    if (msg.jobId !== jobIdRef.current) return;
                    LOG_MSG(
                        `[dokimosaic] processed in ${msg.timings.totalMs.toFixed(0)}ms ` +
                            `(analyze ${msg.timings.analyzeMs.toFixed(0)}ms, ` +
                            `tiles ${msg.timings.fetchMs.toFixed(0)}ms, ` +
                            `render ${msg.timings.renderMs.toFixed(0)}ms, ` +
                            `${msg.distinctTiles} distinct tiles)`,
                    );
                    setResult({
                        model: msg.model,
                        hqBitmap: msg.hqBitmap,
                        hqScale: msg.hqScale,
                        tileKeys: msg.tileKeys,
                        timings: msg.timings,
                        distinctTiles: msg.distinctTiles,
                    });
                    setStatus("done");
                } else if (msg.type === "exported") {
                    const pending = exportsRef.current.get(msg.jobId);
                    if (pending) {
                        exportsRef.current.delete(msg.jobId);
                        LOG_MSG(
                            `[dokimosaic] export rendered in ${msg.timings.renderMs.toFixed(0)}ms, ` +
                                `encoded in ${msg.timings.encodeMs.toFixed(0)}ms ` +
                                `(${msg.width}x${msg.height}${msg.clamped ? ", clamped to canvas limits" : ""})`,
                        );
                        pending.resolve(msg);
                    }
                } else if (msg.type === "error") {
                    const pending = exportsRef.current.get(msg.jobId);
                    if (pending) {
                        exportsRef.current.delete(msg.jobId);
                        pending.reject(new Error(msg.message));
                        return;
                    }
                    if (msg.jobId !== jobIdRef.current) return;
                    LOG_ERROR("[dokimosaic] worker error:", msg.message);
                    setError(msg.message);
                    setStatus("error");
                }
            };
            workerRef.current = worker;
        }
        return workerRef.current;
    }, []);

    const process = useCallback(
        (bitmap, algorithmId, params, excludedKeys = []) => {
            const jobId = ++jobIdRef.current;
            setStatus("processing");
            setStage("starting");
            setError(null);
            setResult((prev) => {
                prev?.hqBitmap?.close?.();
                return null;
            });
            setStartedAt(Date.now());
            getWorker().postMessage({
                type: "process",
                jobId,
                algorithmId,
                params,
                bitmap,
                excludedKeys: [...excludedKeys],
            });
        },
        [getWorker],
    );

    const exportMosaic = useCallback(
        (scale) => {
            const jobId = ++jobIdRef.current;
            return new Promise((resolve, reject) => {
                exportsRef.current.set(jobId, { resolve, reject });
                getWorker().postMessage({ type: "export", jobId, scale });
            });
        },
        [getWorker],
    );

    const cancel = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
            LOG_MSG("[dokimosaic] processing canceled");
        }
        for (const { reject } of exportsRef.current.values()) reject(new Error("Canceled"));
        exportsRef.current.clear();
        jobIdRef.current++;
        setStatus("idle");
        setStage("");
    }, []);

    /** Cancel any work and drop the current result (e.g. new target image). */
    const reset = useCallback(() => {
        cancel();
        setError(null);
        setResult((prev) => {
            prev?.hqBitmap?.close?.();
            return null;
        });
    }, [cancel]);

    useEffect(
        () => () => {
            workerRef.current?.terminate();
        },
        [],
    );

    return { status, stage, startedAt, result, error, process, exportMosaic, cancel, reset };
}
