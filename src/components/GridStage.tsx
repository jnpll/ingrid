"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GridStyle, ImageStore, LayoutNode, Photo } from "@/lib/types";
import {
  applySnap,
  computeGeometry,
  resizeDivider,
  snapCandidates,
  type Canvas,
  type DropSide,
} from "@/lib/layout";
import CellView from "./CellView";

interface Props {
  root: LayoutNode;
  canvas: Canvas;
  style: GridStyle;
  images: ImageStore;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onTreeChange: (next: LayoutNode) => void;
  onCommit: () => void; // push history checkpoint (drag start)
  onUpdatePhoto: (leafId: string, patch: Partial<Photo>) => void;
  onSplit: (leafId: string, dir: "v" | "h") => void;
  onRemove: (leafId: string) => void;
  onRequestPhoto: (leafId: string) => void;
  onMoveCell: (sourceId: string, targetId: string, side: DropSide) => void;
  onDropFiles: (leafId: string | null, files: FileList) => void;
}

interface DragState {
  splitId: string;
  index: number;
  axis: "x" | "y";
  candidates: number[];
}

export default function GridStage({
  root,
  canvas,
  style,
  images,
  selectedId,
  onSelect,
  onTreeChange,
  onCommit,
  onUpdatePhoto,
  onSplit,
  onRemove,
  onRequestPhoto,
  onMoveCell,
  onDropFiles,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [snapLine, setSnapLine] = useState<{ axis: "x" | "y"; pos: number } | null>(
    null
  );
  const drag = useRef<DragState | null>(null);

  // Cell move (shift-drag on a photo): lift the cell out and drop it against
  // an edge of another cell.
  type MoveTarget = { id: string; side: DropSide };
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const moveTargetRef = useRef<MoveTarget | null>(null);
  const moveSourceRef = useRef<string | null>(null);
  const cellsRef = useRef<
    { id: string; x: number; y: number; w: number; h: number }[]
  >([]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setAvail({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const displayScale = useMemo(() => {
    if (!avail.w || !avail.h) return 0;
    const s = Math.min(avail.w / canvas.w, avail.h / canvas.h);
    return Math.min(s, 2); // allow modest upscaling for small canvases
  }, [avail, canvas.w, canvas.h]);

  const geo = useMemo(
    () => computeGeometry(root, canvas, style),
    [root, canvas, style]
  );
  cellsRef.current = geo.cells;

  function stagePoint(e: PointerEvent | React.PointerEvent) {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / displayScale,
      y: (e.clientY - rect.top) / displayScale,
    };
  }

  function startDivider(
    e: React.PointerEvent,
    splitId: string,
    index: number,
    axis: "x" | "y"
  ) {
    e.preventDefault();
    e.stopPropagation();
    onCommit();
    drag.current = {
      splitId,
      index,
      axis,
      candidates: snapCandidates(geo, canvas, style, axis),
    };
    window.addEventListener("pointermove", onDividerMove);
    window.addEventListener("pointerup", endDivider);
  }

  function onDividerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = stagePoint(e);
    const raw = d.axis === "x" ? p.x : p.y;
    const threshold = 8 / (displayScale || 1);
    const { pos, snapped } = applySnap(raw, d.candidates, threshold);
    setSnapLine(snapped === null ? null : { axis: d.axis, pos: snapped });
    const next = resizeDivider(
      root,
      canvas,
      style,
      d.splitId,
      d.index,
      pos,
      { shift: e.shiftKey, minPx: 28 }
    );
    onTreeChange(next);
  }

  function endDivider() {
    drag.current = null;
    setSnapLine(null);
    window.removeEventListener("pointermove", onDividerMove);
    window.removeEventListener("pointerup", endDivider);
  }

  function startMove(leafId: string) {
    moveSourceRef.current = leafId;
    moveTargetRef.current = null;
    setMoveSourceId(leafId);
    setMoveTarget(null);
    window.addEventListener("pointermove", onMoveMove);
    window.addEventListener("pointerup", endMove);
  }

  function onMoveMove(e: PointerEvent) {
    const p = stagePoint(e);
    const hit = cellsRef.current.find(
      (c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h
    );
    if (!hit || hit.id === moveSourceRef.current) {
      moveTargetRef.current = null;
      setMoveTarget(null);
      return;
    }
    // Pick the nearest edge: whichever axis the cursor sits further out on.
    const rx = (p.x - hit.x) / hit.w - 0.5;
    const ry = (p.y - hit.y) / hit.h - 0.5;
    const side: DropSide =
      Math.abs(rx) > Math.abs(ry)
        ? rx > 0
          ? "right"
          : "left"
        : ry > 0
        ? "bottom"
        : "top";
    const next = { id: hit.id, side };
    moveTargetRef.current = next;
    setMoveTarget(next);
  }

  function endMove() {
    const src = moveSourceRef.current;
    const tgt = moveTargetRef.current;
    if (src && tgt && src !== tgt.id) onMoveCell(src, tgt.id, tgt.side);
    moveSourceRef.current = null;
    moveTargetRef.current = null;
    setMoveSourceId(null);
    setMoveTarget(null);
    window.removeEventListener("pointermove", onMoveMove);
    window.removeEventListener("pointerup", endMove);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDividerMove);
      window.removeEventListener("pointerup", endDivider);
      window.removeEventListener("pointermove", onMoveMove);
      window.removeEventListener("pointerup", endMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guideW = Math.max(1, 1.5 / (displayScale || 1));

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 24,
      }}
      onPointerDown={() => onSelect(null)}
    >
      {displayScale > 0 && (
        <div
          style={{
            width: canvas.w * displayScale,
            height: canvas.h * displayScale,
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            borderRadius: 4,
          }}
        >
          <div
            ref={stageRef}
            style={{
              width: canvas.w,
              height: canvas.h,
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
              position: "relative",
              background: style.background,
              borderRadius: 4 / displayScale,
              overflow: "hidden",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={(e) => {
              if (e.dataTransfer.files?.length) {
                e.preventDefault();
                onDropFiles(null, e.dataTransfer.files);
              }
            }}
          >
            {geo.cells.map((cell) => (
              <CellView
                key={cell.id}
                cell={cell}
                asset={cell.node.photo ? images[cell.node.photo.imageId] : undefined}
                photo={cell.node.photo}
                radius={style.radius}
                displayScale={displayScale}
                selected={selectedId === cell.id}
                isMoveSource={moveSourceId === cell.id}
                isMoveTarget={moveTarget?.id === cell.id}
                onSelect={() => onSelect(cell.id)}
                onUpdatePhoto={(patch) => onUpdatePhoto(cell.id, patch)}
                onSplit={(dir) => onSplit(cell.id, dir)}
                onRemove={() => onRemove(cell.id)}
                onRequestPhoto={() => onRequestPhoto(cell.id)}
                onStartMove={() => startMove(cell.id)}
                onDropFiles={(files) => onDropFiles(cell.id, files)}
              />
            ))}

            {geo.dividers.map((d) => (
              <div
                key={`${d.splitId}-${d.index}`}
                onPointerDown={(e) =>
                  startDivider(e, d.splitId, d.index, d.axis)
                }
                style={{
                  position: "absolute",
                  left: d.x,
                  top: d.y,
                  width: d.w,
                  height: d.h,
                  cursor: d.axis === "x" ? "col-resize" : "row-resize",
                  zIndex: 5,
                  touchAction: "none",
                }}
              />
            ))}

            {moveTarget &&
              (() => {
                const c = geo.cells.find((x) => x.id === moveTarget.id);
                if (!c) return null;
                const t = Math.max(6, 10 / (displayScale || 1));
                const s = moveTarget.side;
                const pos: React.CSSProperties =
                  s === "left"
                    ? { left: c.x - t / 2, top: c.y, width: t, height: c.h }
                    : s === "right"
                    ? { left: c.x + c.w - t / 2, top: c.y, width: t, height: c.h }
                    : s === "top"
                    ? { left: c.x, top: c.y - t / 2, width: c.w, height: t }
                    : { left: c.x, top: c.y + c.h - t / 2, width: c.w, height: t };
                return (
                  <div
                    style={{
                      position: "absolute",
                      background: "#22d3ee",
                      borderRadius: t / 2,
                      boxShadow: "0 0 12px rgba(34,211,238,0.7)",
                      pointerEvents: "none",
                      zIndex: 12,
                      ...pos,
                    }}
                  />
                );
              })()}

            {snapLine && (
              <div
                style={{
                  position: "absolute",
                  background: "#22d3ee",
                  pointerEvents: "none",
                  zIndex: 10,
                  ...(snapLine.axis === "x"
                    ? {
                        left: snapLine.pos - guideW / 2,
                        top: 0,
                        width: guideW,
                        height: canvas.h,
                      }
                    : {
                        top: snapLine.pos - guideW / 2,
                        left: 0,
                        height: guideW,
                        width: canvas.w,
                      }),
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
