import { LOG_MSG } from "./debug";

/**
 * Normalize any user-supplied image to PNG-backed data the mosaic engine
 * can use. Every format the browser can decode is accepted; animated GIFs
 * decode to their first frame (createImageBitmap behavior).
 *
 * @returns {Promise<{bitmap: ImageBitmap, url: string, width: number, height: number, name: string}>}
 *   bitmap: for processing; url: object URL of the normalized PNG for previews.
 */
export async function loadFromBlob(blob, name = "image") {
    const t0 = performance.now();
    let bitmap;
    try {
        bitmap = await createImageBitmap(blob);
    } catch {
        throw new Error("That file could not be read as an image.");
    }
    if (!bitmap.width || !bitmap.height) {
        bitmap.close?.();
        throw new Error("That image has no pixels to work with.");
    }

    // Convert to PNG so every downstream step (preview, export) speaks one
    // format regardless of the input.
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: "image/png" });
    LOG_MSG(`[dokimosaic] normalized "${name}" to PNG in ${(performance.now() - t0).toFixed(0)}ms`);

    return {
        bitmap,
        url: URL.createObjectURL(pngBlob),
        width: bitmap.width,
        height: bitmap.height,
        name,
    };
}

/** Load a target image from a URL (subject to the remote host's CORS). */
export async function loadFromUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl.trim());
    } catch {
        throw new Error("That doesn't look like a valid URL.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Only http(s) image URLs are supported.");
    }
    let res;
    try {
        res = await fetch(url, { mode: "cors" });
    } catch {
        throw new Error(
            "Couldn't fetch that URL. The site may not allow cross-origin access. " +
                "Try downloading the image and uploading it instead.",
        );
    }
    if (!res.ok) throw new Error(`The server returned ${res.status} for that URL.`);
    const blob = await res.blob();
    const name = decodeURIComponent(url.pathname.split("/").pop() || "image");
    return loadFromBlob(blob, name);
}
