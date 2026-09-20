import { computeGeometry, type Canvas } from "./layout";
import { coverBox } from "./photo";
import type { GridStyle, ImageStore, LayoutNode } from "./types";

/** Draw a rounded rectangle path on a 2D context. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Load every image asset into HTMLImageElements keyed by imageId. */
function loadImages(
  store: ImageStore
): Promise<Record<string, HTMLImageElement>> {
  const entries = Object.values(store);
  return Promise.all(
    entries.map(
      (a) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve([a.id, img]);
          img.onerror = reject;
          img.src = a.src;
        })
    )
  ).then((pairs) => Object.fromEntries(pairs));
}

/** Render the grid to a full-resolution PNG data URL. */
export async function renderToDataUrl(
  root: LayoutNode,
  canvas: Canvas,
  style: GridStyle,
  store: ImageStore,
  scale = 1
): Promise<string> {
  const el = document.createElement("canvas");
  el.width = Math.round(canvas.w * scale);
  el.height = Math.round(canvas.h * scale);
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = "high";

  // Background
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, canvas.w, canvas.h);

  const images = await loadImages(store);
  const { cells } = computeGeometry(root, canvas, style);

  for (const cell of cells) {
    ctx.save();
    roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, style.radius);
    ctx.clip();

    const photo = cell.node.photo;
    const img = photo ? images[photo.imageId] : undefined;
    const asset = photo ? store[photo.imageId] : undefined;
    if (photo && img && asset) {
      const box = coverBox(cell.w, cell.h, asset.naturalW, asset.naturalH, photo);
      ctx.drawImage(
        img,
        cell.x + box.drawX,
        cell.y + box.drawY,
        box.drawW,
        box.drawH
      );
    } else {
      // Empty cell: subtle fill so the slot is visible in the export.
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    }
    ctx.restore();
  }

  return el.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
