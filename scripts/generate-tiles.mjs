// oxlint-disable no-console
/**
 * Build the tiles.json manifest from tile images stored in Cloudflare R2.
 *
 * For every image under SUBFOLDERS in the bucket (skipping
 * IGNORE_EXTENSIONS and IGNORE_SUFFIXES), downloads the image, computes the
 * compact 8x8 RGB feature patch that all matching algorithms use, and
 * writes tiles.json at the project root. With --upload, also puts the
 * manifest at <MANIFEST_KEY> in the bucket, which is what the site fetches
 * via the CDN.
 *
 * Credentials come from the environment (never stored in the repo):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Optional overrides:
 *   TILES_BUCKET, TILES_SUBFOLDERS (comma-separated),
 *   TILES_IGNORE_EXTENSIONS (comma-separated),
 *   TILES_IGNORE_SUFFIXES (comma-separated)
 *
 * Run:  node scripts/generate-tiles.mjs [--upload]
 */
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { centerSquare, FEAT_GRID, featurePatch } from "./tileFeatures.mjs";

// --- Configuration (overridable via TILES_* environment variables) --------
const BUCKET_NAME = process.env.TILES_BUCKET || "cms-assets";
const SUBFOLDERS = csv(process.env.TILES_SUBFOLDERS) ?? ["dokimotes"];
// Skipped so the manifest only lists original uploads: preview/thumbnail
// variants (_p.webp/_t.webp) fall to the webp rule, and the suffix list
// keeps them out even if webp originals are ever allowed in.
const IGNORE_EXTENSIONS = csv(process.env.TILES_IGNORE_EXTENSIONS) ?? ["gif", "webp", "csv"];
const IGNORE_SUFFIXES = csv(process.env.TILES_IGNORE_SUFFIXES) ?? ["_p.webp", "_t.webp"];

const MANIFEST_KEY = "dokimosaic/tiles.json";
const OUT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "tiles.json");
const WORKERS = 8;

function csv(value) {
    if (!value?.trim()) return null;
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function makeClient() {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error(
            "Missing credentials: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY " +
                "(an R2 API token with read access to the bucket; write access when using --upload).",
        );
        process.exit(1);
    }
    return new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
        maxAttempts: 5,
    });
}

async function listTileKeys(s3) {
    const ignoredExt = new Set(IGNORE_EXTENSIONS.map((e) => e.toLowerCase().replace(/^\./, "")));
    const ignoredSuffix = IGNORE_SUFFIXES.map((s) => s.toLowerCase());
    const keys = new Set(); // Set, not array: dedupes overlapping prefixes
    for (const sub of SUBFOLDERS) {
        const prefix = sub.replace(/\/+$/, "") + "/";
        let pages = 0;
        let token;
        do {
            const page = await s3.send(
                new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix, ContinuationToken: token }),
            );
            pages++;
            for (const obj of page.Contents ?? []) {
                const key = obj.Key;
                const lower = key.toLowerCase();
                const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
                if (key.endsWith("/") || !obj.Size || ignoredExt.has(ext)) continue;
                if (ignoredSuffix.some((s) => lower.endsWith(s))) continue;
                keys.add(key);
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        console.log(`  ${prefix}: ${pages} listing page(s)`);
    }
    return [...keys].sort();
}

async function tileEntry(s3, key) {
    // One bad object (failed download, truncated or non-image file) must not
    // abort the whole export, so everything fallible is inside the try.
    let raw;
    try {
        const body = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        const buffer = Buffer.from(await body.Body.transformToByteArray());
        // sharp decodes the first frame of animated formats by default.
        const img = sharp(buffer);
        const { width, height } = await img.metadata();
        const [x, y, side] = centerSquare(width, height);
        raw = {
            side,
            data: await img.extract({ left: x, top: y, width: side, height: side }).ensureAlpha().raw().toBuffer(),
        };
    } catch (exc) {
        console.error(`  warning: skipping ${key}: ${exc.message}`);
        return null;
    }
    const patch = featurePatch(raw.data, raw.side);
    if (!patch) {
        console.error(`  warning: skipping fully transparent ${key}`);
        return null;
    }
    return { key, feat: Buffer.from(patch).toString("base64") };
}

/** Minimal concurrency pool: run fn over items with at most n in flight. */
async function mapPool(items, n, fn) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(n, items.length) }, async () => {
            while (next < items.length) {
                const i = next++;
                results[i] = await fn(items[i]);
            }
        }),
    );
    return results;
}

async function main() {
    const upload = process.argv.includes("--upload");
    const s3 = makeClient();

    const keys = await listTileKeys(s3);
    console.log(`found ${keys.length} tile images in r2://${BUCKET_NAME} under ${SUBFOLDERS.join(", ")}`);
    if (!keys.length) {
        console.error("nothing to export");
        process.exit(1);
    }

    const entries = (await mapPool(keys, WORKERS, (key) => tileEntry(s3, key))).filter(Boolean);
    if (!entries.length) {
        console.error("every object was skipped, refusing to write an empty manifest");
        process.exit(1);
    }

    const json = JSON.stringify({ version: 1, featGrid: FEAT_GRID, tiles: entries });
    writeFileSync(OUT_PATH, json, "utf-8");
    const skipped = keys.length - entries.length;
    if (skipped) console.error(`  skipped ${skipped} object(s), see warnings above`);
    console.log(`wrote ${entries.length} tiles -> ${OUT_PATH} (${(json.length / 1024).toFixed(1)} KB)`);

    if (upload) {
        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: MANIFEST_KEY,
                Body: json,
                ContentType: "application/json",
                CacheControl: "max-age=600",
            }),
        );
        console.log(`uploaded -> r2://${BUCKET_NAME}/${MANIFEST_KEY}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
