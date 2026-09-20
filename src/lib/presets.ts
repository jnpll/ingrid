import type { CanvasPreset } from "./types";

// A broad set of standard canvas ratios, not limited to social media.
export const CANVAS_PRESETS: CanvasPreset[] = [
  // Social
  { id: "ig-square", label: "Square 1:1", group: "Social", w: 1080, h: 1080 },
  { id: "ig-portrait", label: "Portrait 4:5", group: "Social", w: 1080, h: 1350 },
  { id: "story", label: "Story 9:16", group: "Social", w: 1080, h: 1920 },
  { id: "landscape-191", label: "Landscape 1.91:1", group: "Social", w: 1080, h: 566 },
  // Standard photo ratios
  { id: "photo-3-2", label: "3:2", group: "Photo", w: 1080, h: 720 },
  { id: "photo-2-3", label: "2:3", group: "Photo", w: 720, h: 1080 },
  { id: "photo-4-3", label: "4:3", group: "Photo", w: 1080, h: 810 },
  { id: "photo-3-4", label: "3:4", group: "Photo", w: 810, h: 1080 },
  { id: "photo-16-9", label: "16:9", group: "Photo", w: 1280, h: 720 },
  { id: "photo-9-16", label: "9:16", group: "Photo", w: 720, h: 1280 },
  // Print (at 150 dpi, kept modest for canvas perf)
  { id: "a4-portrait", label: "A4 Portrait", group: "Print", w: 1240, h: 1754 },
  { id: "a4-landscape", label: "A4 Landscape", group: "Print", w: 1754, h: 1240 },
  { id: "letter-portrait", label: "US Letter", group: "Print", w: 1275, h: 1650 },
];

export const DEFAULT_PRESET = CANVAS_PRESETS[0];
