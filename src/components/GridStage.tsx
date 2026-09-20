"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GridStyle, ImageStore, LayoutNode, Photo } from "@/lib/types";
import {
  applySnap,
  computeGeometry,
  resizeDivider,
  snapCandidates,
  type Canvas,
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
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [snapLine, setSnapLine] = useState<{ axis: "x" | "y"; pos: number } | null>(
    null
  );
  const drag = useRef<DragState | null>(null);

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

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDividerMove);
      window.removeEventListener("pointerup", endDivider);
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
                onSelect={() => onSelect(cell.id)}
                onUpdatePhoto={(patch) => onUpdatePhoto(cell.id, patch)}
                onSplit={(dir) => onSplit(cell.id, dir)}
                onRemove={() => onRemove(cell.id)}
                onRequestPhoto={() => onRequestPhoto(cell.id)}
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
