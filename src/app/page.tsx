"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridStage from "@/components/GridStage";
import Toolbar from "@/components/Toolbar";
import {
  emptyLeafIds,
  initialTree,
  removeLeaf,
  setPhoto,
  splitLeaf,
  updatePhoto,
} from "@/lib/layout";
import { CANVAS_PRESETS, DEFAULT_PRESET } from "@/lib/presets";
import { downloadDataUrl, renderToDataUrl } from "@/lib/exportPng";
import type {
  GridStyle,
  ImageAsset,
  ImageStore,
  LayoutNode,
  Photo,
} from "@/lib/types";
import { uid } from "@/lib/layout";

const DEFAULT_STYLE: GridStyle = {
  gap: 12,
  radius: 12,
  padding: 12,
  background: "#0e1116",
};

export default function Page() {
  const [tree, setTree] = useState<LayoutNode>(() => initialTree());
  const [images, setImages] = useState<ImageStore>({});
  const [style, setStyle] = useState<GridStyle>(DEFAULT_STYLE);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [isCustom, setIsCustom] = useState(false);
  const [custom, setCustomDims] = useState({ w: 1080, h: 1080 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [past, setPast] = useState<LayoutNode[]>([]);
  const [future, setFuture] = useState<LayoutNode[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<string | "bulk" | null>(null);

  const canvas = useMemo(() => {
    if (isCustom) return { w: custom.w, h: custom.h };
    const p = CANVAS_PRESETS.find((x) => x.id === presetId) ?? DEFAULT_PRESET;
    return { w: p.w, h: p.h };
  }, [isCustom, custom, presetId]);

  // ---- history helpers ----
  const commit = useCallback(() => {
    setPast((p) => [...p.slice(-49), tree]);
    setFuture([]);
  }, [tree]);

  const commitAnd = useCallback(
    (next: LayoutNode) => {
      setPast((p) => [...p.slice(-49), tree]);
      setFuture([]);
      setTree(next);
    },
    [tree]
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [tree, ...f]);
      setTree(prev);
      return p.slice(0, -1);
    });
  }, [tree]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nxt = f[0];
      setPast((p) => [...p, tree]);
      setTree(nxt);
      return f.slice(1);
    });
  }, [tree]);

  // ---- photo handling ----
  const assetFromFile = (file: File): Promise<ImageAsset> =>
    new Promise((resolve, reject) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () =>
        resolve({ id: uid("img"), src, naturalW: img.naturalWidth, naturalH: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });

  const newPhoto = (imageId: string): Photo => ({ imageId, zoom: 1, panX: 0, panY: 0 });

  async function onFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const assets = await Promise.all(list.map(assetFromFile));
    setImages((s) => {
      const next = { ...s };
      for (const a of assets) next[a.id] = a;
      return next;
    });

    const target = pending.current;
    pending.current = null;

    // Determine which leaves receive photos, in order.
    let nextTree = tree;
    let assetIdx = 0;
    if (target && target !== "bulk") {
      nextTree = setPhoto(nextTree, target, newPhoto(assets[0].id));
      assetIdx = 1;
    }
    // Fill remaining empty cells with any remaining photos.
    const empties = emptyLeafIds(nextTree).filter((id) => id !== target);
    for (const leafId of empties) {
      if (assetIdx >= assets.length) break;
      nextTree = setPhoto(nextTree, leafId, newPhoto(assets[assetIdx].id));
      assetIdx += 1;
    }
    commitAnd(nextTree);
    if (fileRef.current) fileRef.current.value = "";
  }

  const requestPhoto = useCallback((leafId: string) => {
    pending.current = leafId;
    fileRef.current?.click();
  }, []);

  const addPhotosBulk = useCallback(() => {
    pending.current = "bulk";
    fileRef.current?.click();
  }, []);

  // ---- tree ops ----
  const doSplit = useCallback(
    (leafId: string, dir: "v" | "h") => commitAnd(splitLeaf(tree, leafId, dir)),
    [tree, commitAnd]
  );
  const doRemove = useCallback(
    (leafId: string) => {
      // Deleting the only cell can't remove it (nothing to fall back to), so
      // just clear its photo — it becomes an empty cell.
      if (tree.type === "leaf" && tree.id === leafId) {
        commitAnd(setPhoto(tree, leafId, undefined));
      } else {
        commitAnd(removeLeaf(tree, leafId));
      }
      setSelectedId(null);
    },
    [tree, commitAnd]
  );
  const doUpdatePhoto = useCallback(
    (leafId: string, patch: Partial<Photo>) =>
      setTree((t) => updatePhoto(t, leafId, patch)),
    []
  );

  const resetLayout = useCallback(() => {
    commitAnd(initialTree());
    setSelectedId(null);
  }, [commitAnd]);

  // ---- export ----
  const doExport = useCallback(async () => {
    setExporting(true);
    try {
      const url = await renderToDataUrl(tree, canvas, style, images, 1);
      downloadDataUrl(url, `photo-grid-${canvas.w}x${canvas.h}.png`);
    } finally {
      setExporting(false);
    }
  }, [tree, canvas, style, images]);

  // ---- keyboard ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        doRemove(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedId, doRemove]);

  return (
    <div className="pgm-app">
      <Toolbar
        presetId={presetId}
        custom={custom}
        isCustom={isCustom}
        onPreset={(id) => {
          setIsCustom(false);
          setPresetId(id);
        }}
        onCustom={(w, h) => {
          setIsCustom(true);
          setCustomDims({ w, h });
        }}
        style={style}
        onStyle={(patch) => setStyle((s) => ({ ...s, ...patch }))}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onReset={resetLayout}
        onAddPhotos={addPhotosBulk}
        onExport={doExport}
        exporting={exporting}
      />

      <GridStage
        root={tree}
        canvas={canvas}
        style={style}
        images={images}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onTreeChange={setTree}
        onCommit={commit}
        onUpdatePhoto={doUpdatePhoto}
        onSplit={doSplit}
        onRemove={doRemove}
        onRequestPhoto={requestPhoto}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => onFilesChosen(e.target.files)}
      />
    </div>
  );
}
