import type { Photo } from "./types";

export interface CoverBox {
  drawX: number; // left of the image relative to the cell's origin
  drawY: number;
  drawW: number;
  drawH: number;
}

/**
 * Compute where an image should be drawn to "cover" a cell, given zoom and pan.
 * Used identically by the live DOM preview and the export canvas so what you
 * see is exactly what you get.
 */
export function coverBox(
  cellW: number,
  cellH: number,
  imgW: number,
  imgH: number,
  photo: Pick<Photo, "zoom" | "panX" | "panY">
): CoverBox {
  const coverScale = Math.max(cellW / imgW, cellH / imgH);
  const scale = coverScale * Math.max(1, photo.zoom);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const overflowX = drawW - cellW;
  const overflowY = drawH - cellH;
  const px = clamp(photo.panX, -1, 1);
  const py = clamp(photo.panY, -1, 1);
  const drawX = -overflowX / 2 + (px * overflowX) / 2;
  const drawY = -overflowY / 2 + (py * overflowY) / 2;
  return { drawX, drawY, drawW, drawH };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
