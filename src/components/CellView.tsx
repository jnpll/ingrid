"use client";

import { useState, useRef } from "react";
import type { CellRect } from "@/lib/types";
import type { ImageAsset, Photo } from "@/lib/types";
import { coverBox, clamp } from "@/lib/photo";

interface Props {
  cell: CellRect;
  asset?: ImageAsset;
  photo?: Photo;
  radius: number;
  displayScale: number;
  selected: boolean;
  isMoveSource: boolean;
  isMoveTarget: boolean;
  onSelect: () => void;
  onUpdatePhoto: (patch: Partial<Photo>) => void;
  onSplit: (dir: "v" | "h") => void;
  onRemove: () => void;
  onRequestPhoto: () => void;
  onStartMove: () => void;
  onDropFiles: (files: FileList) => void;
}

export default function CellView({
  cell,
  asset,
  photo,
  radius,
  displayScale,
  selected,
  isMoveSource,
  isMoveTarget,
  onSelect,
  onUpdatePhoto,
  onSplit,
  onRemove,
  onRequestPhoto,
  onStartMove,
  onDropFiles,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const panState = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    ovX: number;
    ovY: number;
  } | null>(null);

  const box =
    asset && photo
      ? coverBox(cell.w, cell.h, asset.naturalW, asset.naturalH, photo)
      : null;

  function onPointerDown(e: React.PointerEvent) {
    onSelect();
    if (e.button !== 0) return;
    // Shift-drag picks the cell up to move/swap it — works on empty cells too.
    if (e.shiftKey) {
      e.stopPropagation();
      onStartMove();
      return;
    }
    if (!asset || !photo || !box) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      panX: photo.panX,
      panY: photo.panY,
      ovX: box.drawW - cell.w,
      ovY: box.drawH - cell.h,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = panState.current;
    if (!s) return;
    const dx = (e.clientX - s.x) / displayScale;
    const dy = (e.clientY - s.y) / displayScale;
    const patch: Partial<Photo> = {};
    if (s.ovX > 0) patch.panX = clamp(s.panX + (dx * 2) / s.ovX, -1, 1);
    if (s.ovY > 0) patch.panY = clamp(s.panY + (dy * 2) / s.ovY, -1, 1);
    onUpdatePhoto(patch);
  }

  function endPan(e: React.PointerEvent) {
    if (panState.current) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
    }
    panState.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    if (!photo) return;
    e.stopPropagation();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const zoom = clamp(photo.zoom * factor, 1, 6);
    onUpdatePhoto({ zoom });
  }

  // Button sizes are expressed in canvas px so they scale with the stage.
  const btn = Math.round(26 / displayScale);
  const pad = Math.round(6 / displayScale);
  const fontBtn = Math.round(14 / displayScale);

  const outlineColor = dragOver ? "#22d3ee" : selected ? "#6366f1" : null;

  return (
    <div
      className={`pgm-cell${selected ? " selected" : ""}`}
      style={{
        position: "absolute",
        left: cell.x,
        top: cell.y,
        width: cell.w,
        height: cell.h,
        borderRadius: radius,
        overflow: "hidden",
        background: asset ? "transparent" : "rgba(255,255,255,0.03)",
        outline: outlineColor
          ? `${Math.max(1, (dragOver ? 3 : 2) / displayScale)}px solid ${outlineColor}`
          : "none",
        outlineOffset: -2,
        opacity: isMoveSource ? 0.35 : 1,
        cursor: asset ? "grab" : "pointer",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onWheel={onWheel}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!dragOver) setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          onDropFiles(e.dataTransfer.files);
        }
      }}
    >
      {box && asset ? (
        <img
          src={asset.src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: box.drawX,
            top: box.drawY,
            width: box.drawW,
            height: box.drawH,
            maxWidth: "none",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            if (e.shiftKey) return; // shift is reserved for moving the cell
            e.stopPropagation();
            onRequestPhoto();
          }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: pad,
            color: "rgba(255,255,255,0.55)",
            fontSize: Math.round(15 / displayScale),
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: Math.round(22 / displayScale) }}>+</span>
          Add photo
        </button>
      )}

      {isMoveTarget && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(34,211,238,0.14)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Hover / selection controls */}
      {(
        <div
          className="pgm-controls"
          style={{
            position: "absolute",
            top: pad,
            right: pad,
            display: "flex",
            gap: pad,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CtrlButton size={btn} font={fontBtn} title="Split vertically" onClick={() => onSplit("v")}>
            ⇔
          </CtrlButton>
          <CtrlButton size={btn} font={fontBtn} title="Split horizontally" onClick={() => onSplit("h")}>
            ⇕
          </CtrlButton>
          {asset && (
            <CtrlButton size={btn} font={fontBtn} title="Replace photo" onClick={onRequestPhoto}>
              ⤒
            </CtrlButton>
          )}
          <CtrlButton size={btn} font={fontBtn} title="Delete cell" danger onClick={onRemove}>
            ×
          </CtrlButton>
        </div>
      )}
    </div>
  );
}

function CtrlButton({
  children,
  onClick,
  title,
  size,
  font,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  size: number;
  font: number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size * 0.25,
        border: "none",
        fontSize: font,
        lineHeight: 1,
        color: "#fff",
        background: danger ? "rgba(239,68,68,0.9)" : "rgba(17,24,39,0.82)",
        backdropFilter: "blur(4px)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
