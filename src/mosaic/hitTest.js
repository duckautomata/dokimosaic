/**
 * Map a point in model coordinates to the mosaic piece under it, for the
 * viewer's hover tooltip and highlight. Returns
 * { tileIdx, shape } or null. Shapes:
 *   { kind: "rect", x, y, w, h }
 *   { kind: "hex", x, y, w, h }               (bounding box of the hexagon)
 *   { kind: "sticker", cx, cy, s, angle }
 *   { kind: "label", cell, x, y, w, h }       (bounding box in model coords)
 */
export function hitTest(model, x, y) {
    if (x < 0 || y < 0 || x >= model.width || y >= model.height) return null;
    switch (model.type) {
        case "grid":
        case "blend":
        case "dither":
            return hitGrid(model, x, y);
        case "quadtree":
        case "fractal":
            return hitRects(model, x, y);
        case "hex":
            return hitHex(model, x, y);
        case "scatter":
            return hitScatter(model, x, y);
        case "voronoi":
        case "superpixel":
            return hitLabels(model, x, y);
        default:
            return null;
    }
}

function hitGrid(model, x, y) {
    const { cols, rows, cell, idx } = model;
    const c = Math.min(cols - 1, Math.floor(x / cell));
    const r = Math.min(rows - 1, Math.floor(y / cell));
    const i = r * cols + c;
    if (idx[i] < 0) return null; // transparent cell
    return { tileIdx: idx[i], shape: { kind: "rect", x: c * cell, y: r * cell, w: cell, h: cell } };
}

function hitRects(model, x, y) {
    const { rects, idx } = model;
    for (let i = 0; i < idx.length; i++) {
        const rx = rects[i * 4],
            ry = rects[i * 4 + 1],
            rw = rects[i * 4 + 2],
            rh = rects[i * 4 + 3];
        if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
            if (idx[i] < 0) return null; // transparent leaf
            return { tileIdx: idx[i], shape: { kind: "rect", x: rx, y: ry, w: rw, h: rh } };
        }
    }
    return null;
}

/** Point-in-pointy-top-hexagon inside a (w x h) bounding box at local coords. */
function insideHex(px, py, w, h) {
    if (px < 0 || px > w || py < 0 || py > h) return false;
    const dx = Math.abs(px - w / 2);
    const dy = Math.abs(py - h / 2);
    if (dy <= h / 4) return dx <= w / 2;
    // Sloped caps: at dy = h/4 the half-width is w/2; at dy = h/2 it is 0.
    return dx / (w / 2) <= (h / 2 - dy) / (h / 4);
}

function hitHex(model, x, y) {
    const { pos, idx, hexW, hexH } = model;
    // Rows overlap vertically, so a point can sit in one of two rows; the
    // later-drawn hex wins (matches paint order). Scan from the end.
    for (let i = idx.length - 1; i >= 0; i--) {
        const x0 = pos[i * 2],
            y0 = pos[i * 2 + 1];
        if (y < y0 || y > y0 + hexH || x < x0 || x > x0 + hexW) continue;
        if (insideHex(x - x0, y - y0, hexW, hexH)) {
            return { tileIdx: idx[i], shape: { kind: "hex", x: x0, y: y0, w: hexW, h: hexH } };
        }
    }
    return null;
}

function hitScatter(model, x, y) {
    const { data, idx } = model;
    // Last drawn is on top.
    for (let i = idx.length - 1; i >= 0; i--) {
        const cx = data[i * 4],
            cy = data[i * 4 + 1],
            s = data[i * 4 + 2],
            angle = data[i * 4 + 3];
        const cos = Math.cos(-angle),
            sin = Math.sin(-angle);
        const lx = (x - cx) * cos - (y - cy) * sin;
        const ly = (x - cx) * sin + (y - cy) * cos;
        if (Math.abs(lx) <= s / 2 && Math.abs(ly) <= s / 2) {
            return { tileIdx: idx[i], shape: { kind: "sticker", cx, cy, s, angle } };
        }
    }
    return null;
}

function hitLabels(model, x, y) {
    const { labels, box, idx, lw, lh } = model;
    const lx = Math.min(lw - 1, Math.floor((x * lw) / model.width));
    const ly = Math.min(lh - 1, Math.floor((y * lh) / model.height));
    const cell = labels[ly * lw + lx];
    if (cell < 0 || idx[cell] < 0) return null;
    const sx = model.width / lw,
        sy = model.height / lh;
    return {
        tileIdx: idx[cell],
        shape: {
            kind: "label",
            cell,
            x: box[cell * 4] * sx,
            y: box[cell * 4 + 1] * sy,
            w: (box[cell * 4 + 2] - box[cell * 4] + 1) * sx,
            h: (box[cell * 4 + 3] - box[cell * 4 + 1] + 1) * sy,
        },
    };
}
