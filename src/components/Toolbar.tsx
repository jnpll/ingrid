"use client";

import type { CanvasPreset, GridStyle } from "@/lib/types";
import { CANVAS_PRESETS } from "@/lib/presets";
import Kbd from "./Kbd";

interface Props {
  presetId: string;
  custom: { w: number; h: number };
  isCustom: boolean;
  onPreset: (id: string) => void;
  onCustom: (w: number, h: number) => void;
  style: GridStyle;
  onStyle: (patch: Partial<GridStyle>) => void;
  onResetStyle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onAddPhotos: () => void;
  onExport: () => void;
  exporting: boolean;
}

const groups = Array.from(new Set(CANVAS_PRESETS.map((p) => p.group)));

export default function Toolbar(props: Props) {
  const {
    presetId,
    custom,
    isCustom,
    onPreset,
    onCustom,
    style,
    onStyle,
    onResetStyle,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onReset,
    onAddPhotos,
    onExport,
    exporting,
  } = props;

  return (
    <aside className="pgm-toolbar">
      <div className="pgm-brand">
        <span className="pgm-logo">▦</span> Photo Grid Maker
      </div>

      <button className="pgm-primary" onClick={onAddPhotos}>
        + Add photos
      </button>

      <Section title="Canvas">
        <select
          className="pgm-select"
          value={isCustom ? "custom" : presetId}
          onChange={(e) => {
            if (e.target.value === "custom") onCustom(custom.w, custom.h);
            else onPreset(e.target.value);
          }}
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {CANVAS_PRESETS.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.w}×{p.h}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {isCustom && (
          <div className="pgm-row">
            <label className="pgm-num">
              W
              <input
                type="number"
                min={64}
                max={6000}
                value={custom.w}
                onChange={(e) => onCustom(clampInt(e.target.value, 64, 6000), custom.h)}
              />
            </label>
            <label className="pgm-num">
              H
              <input
                type="number"
                min={64}
                max={6000}
                value={custom.h}
                onChange={(e) => onCustom(custom.w, clampInt(e.target.value, 64, 6000))}
              />
            </label>
          </div>
        )}
      </Section>

      <Section
        title="Style"
        action={
          <button type="button" className="pgm-linkbtn" onClick={onResetStyle}>
            Reset
          </button>
        }
      >
        <Slider
          label="Gap"
          value={style.gap}
          min={0}
          max={120}
          onChange={(gap) => onStyle({ gap })}
        />
        <Slider
          label="Corner radius"
          value={style.radius}
          min={0}
          max={200}
          onChange={(radius) => onStyle({ radius })}
        />
        <Slider
          label="Outer padding"
          value={style.padding}
          min={0}
          max={200}
          onChange={(padding) => onStyle({ padding })}
        />
        <label className="pgm-color">
          Background
          <input
            type="color"
            value={style.background}
            onChange={(e) => onStyle({ background: e.target.value })}
          />
        </label>
      </Section>

      <Section title="History">
        <div className="pgm-row">
          <button className="pgm-btn" disabled={!canUndo} onClick={onUndo}>
            ↶ Undo
          </button>
          <button className="pgm-btn" disabled={!canRedo} onClick={onRedo}>
            ↷ Redo
          </button>
        </div>
        <button className="pgm-btn pgm-wide" onClick={onReset}>
          Reset layout
        </button>
      </Section>

      <div className="pgm-spacer" />

      <button className="pgm-export" onClick={onExport} disabled={exporting}>
        {exporting ? "Rendering…" : "⬇ Export PNG"}
      </button>
      <div className="pgm-hint">
        <p>
          Drag a divider to resize the whole row/column. Hold <Kbd>Shift</Kbd>{" "}
          to shrink the far side proportionally. Double-click a divider to
          distribute evenly.
        </p>
        <p>
          <Kbd>Shift</Kbd> + drag a cell onto another: its <b>edge</b> moves the
          cell there, its <b>center</b> swaps the two. Drag to the canvas border
          for a full-span row/column.
        </p>
        <p>Drag divider near an edge to snap. Drop image files onto a cell.</p>
        <p>
          <Kbd>⌘</Kbd>
          <Kbd>Z</Kbd> undo · <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>Z</Kbd> redo · <Kbd>Del</Kbd> remove cell
        </p>
      </div>
    </aside>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pgm-section">
      <div className="pgm-section-head">
        <div className="pgm-section-title">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="pgm-slider">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function clampInt(v: string, lo: number, hi: number): number {
  const n = Math.round(Number(v) || 0);
  return Math.max(lo, Math.min(hi, n));
}

export type { CanvasPreset };
