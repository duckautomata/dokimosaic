import { useRef, useState } from "react";
import { loadFromBlob, loadFromUrl } from "../utils/imageLoad";
import "./ImageInput.css";

/**
 * Target-image input: drag & drop, click to upload, or a URL field.
 * (Paste is handled globally by the Home page.) Any browser-decodable
 * format is accepted and normalized to PNG; animated GIFs use their first
 * frame.
 *
 * @param {Object} props
 * @param {(source: {bitmap: ImageBitmap, url: string, width: number, height: number, name: string}) => void} props.onImage
 */
export default function ImageInput({ onImage }) {
    const fileRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [urlValue, setUrlValue] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const handle = async (loader) => {
        setBusy(true);
        setError(null);
        try {
            onImage(await loader());
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const onFiles = (files) => {
        const file = [...files].find((f) => f.type.startsWith("image/")) || files[0];
        if (!file) return;
        handle(() => loadFromBlob(file, file.name));
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) {
            onFiles(e.dataTransfer.files);
            return;
        }
        const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
        if (url && /^https?:\/\//i.test(url.trim())) {
            handle(() => loadFromUrl(url));
        }
    };

    const onUrlSubmit = (e) => {
        e.preventDefault();
        if (!urlValue.trim() || busy) return;
        handle(() => loadFromUrl(urlValue));
    };

    return (
        <div className="image-input">
            <div
                className={`image-dropzone ${dragging ? "dragging" : ""} ${busy ? "disabled" : ""}`.trim()}
                role="button"
                tabIndex={0}
                aria-label="Upload an image"
                onClick={() => !busy && fileRef.current?.click()}
                onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !busy) {
                        e.preventDefault();
                        fileRef.current?.click();
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                {busy ? (
                    <div className="image-dropzone-empty">
                        <span className="spinner" />
                        <span>Loading image…</span>
                    </div>
                ) : (
                    <div className="image-dropzone-empty">
                        <UploadIcon />
                        <strong>Drop an image here</strong>
                        <span>or click to upload · you can also paste from the clipboard</span>
                    </div>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                        if (e.target.files?.length) onFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>

            <form className="image-url-row" onSubmit={onUrlSubmit}>
                <input
                    className="image-url-input"
                    type="url"
                    placeholder="…or paste an image URL"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    disabled={busy}
                />
                <button type="submit" className="secondary-btn image-url-btn" disabled={busy || !urlValue.trim()}>
                    Load
                </button>
            </form>

            {error && <div className="status-box error">{error}</div>}
        </div>
    );
}

const UploadIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8l-5-5-5 5" />
        <path d="M12 3v12" />
    </svg>
);
