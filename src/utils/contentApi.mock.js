import { siteName } from "../config";
import { LOG_MSG } from "./debug";

const MOCK_CONFIG = Object.freeze({
    turnstile_site_key: "mock-site-key",
    turnstile_enabled: true,
    allowed_sites: ["dokimotes", "dokimosaic"],
    max_image_bytes: 26214400,
    supported_formats: ["jpg", "jpeg", "png", "webp", "avif", "gif", "mp4"],
    public_url_prefix: "https://cdn.mock",
    pending_prefix: "_suggestions/_pending/",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = (min, max) => Math.floor(min + Math.random() * (max - min));

const randomId = (length = 11) => {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
};

let submitCount = 0;

export const fetchPublicConfig = async () => {
    await sleep(randomDelay(50, 150));
    LOG_MSG("[mock] fetchPublicConfig →", MOCK_CONFIG);
    return MOCK_CONFIG;
};

export const submitSuggestion = async ({ token, kind, payload, imageIds = [], site = siteName }) => {
    await sleep(randomDelay(400, 800));
    submitCount += 1;

    const result = { id: `sug_${randomId(13)}` };

    LOG_MSG(`[mock] submitSuggestion #${submitCount} →`, {
        request: {
            cf_turnstile_response: token,
            site,
            kind,
            payload,
            image_ids: imageIds,
        },
        response: result,
    });

    return result;
};
