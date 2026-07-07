import { contentApi, siteName } from "../config";

let cachedConfig = null;
let inFlightConfig = null;

const readErrorDetail = async (res) => {
    try {
        const body = await res.json();
        if (body && typeof body.detail === "string") return body.detail;
    } catch {
        // ignore JSON parse errors; fall back to status text
    }
    return `${res.status} ${res.statusText}`.trim();
};

export const fetchPublicConfig = async () => {
    if (cachedConfig) return cachedConfig;
    if (inFlightConfig) return inFlightConfig;

    inFlightConfig = (async () => {
        const res = await fetch(`${contentApi}/public/config`);
        if (!res.ok) {
            throw new Error(`Failed to load public config: ${await readErrorDetail(res)}`);
        }
        cachedConfig = await res.json();
        return cachedConfig;
    })().finally(() => {
        inFlightConfig = null;
    });

    return inFlightConfig;
};

export const submitSuggestion = async ({ token, kind, payload, imageIds = [], site = siteName }) => {
    const res = await fetch(`${contentApi}/public/suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            cf_turnstile_response: token,
            site,
            kind,
            payload,
            image_ids: imageIds,
        }),
    });
    if (!res.ok) {
        throw new Error(await readErrorDetail(res));
    }
    return res.json();
};
