"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  GlassPanel,
  Input,
  Kbd,
  Label,
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
  ScrollArea,
  Separator,
  Slider,
} from "@jnpll/elements-ui";
import { ThemeSelector } from "@jnpll/elements-ui/theme-selector";
import { CANVAS_PRESETS } from "@/lib/presets";
import type { GridStyle } from "@/lib/types";

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

export default function Toolbar({
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
}: Props) {
  return (
    <aside className="pgm-toolbar" aria-label="Editor controls">
      <div className="pgm-toolbar-header">
        <div className="pgm-brand-mark" aria-hidden="true"><span className="pgm-brand-icon" /></div>
        <div className="pgm-brand-copy">
          <div className="pgm-brand-name">InGrid<span className="pgm-brand-dot">.</span></div>
          <div className="pgm-brand-caption">PHOTO COMPOSITION STUDIO</div>
        </div>
        <ThemeSelector className="pgm-theme-trigger" label="Choose theme and palette" />
      </div>

      <ScrollArea className="pgm-sidebar-scroll">
        <div className="pgm-sidebar-content">
          <GlassPanel ring strong className="pgm-upload-panel">
            <div className="pgm-upload-icon">＋</div>
            <div className="pgm-upload-title">Make it yours</div>
            <p className="pgm-upload-copy">Bring in your photos to start composing a custom grid.</p>
            <Button size="lg" className="pgm-upload-button" onClick={onAddPhotos}>
              ＋ Add photos
            </Button>
          </GlassPanel>

          <Card size="sm" className="pgm-control-card">
            <CardHeader className="pgm-card-header">
              <CardTitle>Canvas</CardTitle>
              <Badge variant="secondary">01</Badge>
            </CardHeader>
            <CardContent className="pgm-card-content">
              <Label htmlFor="canvas-preset">Format</Label>
              <NativeSelect className="w-full" id="canvas-preset" value={isCustom ? "custom" : presetId} onChange={(e) => {
                if (e.target.value === "custom") onCustom(custom.w, custom.h);
                else onPreset(e.target.value);
              }}>
                {groups.map((group) => (
                  <NativeSelectOptGroup key={group} label={group}>
                    {CANVAS_PRESETS.filter((p) => p.group === group).map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>{p.label} · {p.w} × {p.h}</NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ))}
                <NativeSelectOption value="custom">Custom size</NativeSelectOption>
              </NativeSelect>
              {isCustom && (
                <div className="pgm-dimensions">
                  <div><Label htmlFor="canvas-width">Width</Label><Input id="canvas-width" type="number" min={64} max={6000} value={custom.w} onChange={(e) => onCustom(clampInt(e.target.value, 64, 6000), custom.h)} /></div>
                  <span aria-hidden="true">×</span>
                  <div><Label htmlFor="canvas-height">Height</Label><Input id="canvas-height" type="number" min={64} max={6000} value={custom.h} onChange={(e) => onCustom(custom.w, clampInt(e.target.value, 64, 6000))} /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card size="sm" className="pgm-control-card">
            <CardHeader className="pgm-card-header">
              <CardTitle>Appearance</CardTitle>
              <Badge variant="secondary">02</Badge>
            </CardHeader>
            <CardContent className="pgm-card-content">
              <ControlSlider label="Spacing" value={style.gap} max={120} onChange={(gap) => onStyle({ gap })} />
              <ControlSlider label="Corner radius" value={style.radius} max={200} onChange={(radius) => onStyle({ radius })} />
              <ControlSlider label="Canvas margin" value={style.padding} max={200} onChange={(padding) => onStyle({ padding })} />
              <Separator />
              <div className="pgm-color-row">
                <div><Label htmlFor="canvas-background">Background</Label><span>Canvas color</span></div>
                <input id="canvas-background" type="color" value={style.background} onChange={(e) => onStyle({ background: e.target.value })} />
              </div>
              <Button variant="ghost" size="sm" className="pgm-reset-style" onClick={onResetStyle}>↺ Reset appearance</Button>
            </CardContent>
          </Card>

          <Card size="sm" className="pgm-control-card">
            <CardHeader className="pgm-card-header"><CardTitle>History</CardTitle><Badge variant="secondary">03</Badge></CardHeader>
            <CardContent className="pgm-card-content">
              <ButtonGroup className="pgm-history-group">
                <Button variant="outline" disabled={!canUndo} onClick={onUndo}>← Undo</Button>
                <Button variant="outline" disabled={!canRedo} onClick={onRedo}>Redo →</Button>
              </ButtonGroup>
              <Button variant="ghost" className="pgm-reset-layout" onClick={onReset}>↺ Reset layout</Button>
            </CardContent>
          </Card>

          <div className="pgm-tips">
            <div className="pgm-tips-heading">✧ Quick tips</div>
            <p>Drag dividers to resize. Double-click one to distribute evenly.</p>
            <p><Kbd>Shift</Kbd> + drag a cell to move or swap it. Hold <Kbd>Alt</Kbd> on a divider to resize its whole row or column.</p>
            <p>Drop photos onto cells, scroll over a photo to zoom, and drag it to reframe.</p>
          </div>
        </div>
      </ScrollArea>

      <div className="pgm-toolbar-footer">
        <Button size="lg" className="pgm-export-button" onClick={onExport} disabled={exporting}>
          ↓ {exporting ? "Rendering…" : "Export PNG"}
        </Button>
        <span>High resolution · Ready to share</span>
      </div>
    </aside>
  );
}

function ControlSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <div className="pgm-slider-control">
    <div className="pgm-slider-heading"><Label>{label}</Label><span>{value} px</span></div>
    <Slider value={[value]} min={0} max={max} onValueChange={(next) => onChange(Array.isArray(next) ? next[0] ?? 0 : next)} aria-label={label} />
  </div>;
}

function clampInt(value: string, lo: number, hi: number): number {
  const n = Math.round(Number(value) || 0);
  return Math.max(lo, Math.min(hi, n));
}
