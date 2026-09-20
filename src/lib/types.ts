// Core data model for the photo grid.
//
// Layout is an n-ary "split tree":
//   - A Split arranges its children along one axis:
//       axis 'x'  -> children sit side by side  (vertical dividers between them)
//       axis 'y'  -> children stack top-to-bottom (horizontal dividers between them)
//   - `sizes` are fractions (0..1) that always sum to 1 across the children.
//   - A Leaf is a single cell that may hold one photo.
//
// Everything is resolution-independent: we only store fractions, so the same
// tree renders identically at editor size and at full export resolution.

export type Axis = "x" | "y";

/** Heavy image data, kept in a store outside the layout tree. */
export interface ImageAsset {
  id: string;
  src: string; // object URL or data URL
  naturalW: number;
  naturalH: number;
}

export type ImageStore = Record<string, ImageAsset>;

/** Lightweight photo reference + transform, stored on a leaf. */
export interface Photo {
  imageId: string;
  /** Zoom relative to "cover" fit. 1 = exactly covers the cell. */
  zoom: number;
  /** Pan within the overflow, each in [-1, 1]. 0 = centered. */
  panX: number;
  panY: number;
}

export interface LeafNode {
  type: "leaf";
  id: string;
  photo?: Photo;
}

export interface SplitNode {
  type: "split";
  id: string;
  axis: Axis;
  children: LayoutNode[];
  /** Fractions summing to 1, one per child. */
  sizes: number[];
}

export type LayoutNode = LeafNode | SplitNode;

export interface CanvasPreset {
  id: string;
  label: string;
  group: string;
  w: number;
  h: number;
}

export interface GridStyle {
  /** Gap between cells, in canvas px. */
  gap: number;
  /** Corner radius of each cell, in canvas px. */
  radius: number;
  /** Padding around the whole grid, in canvas px. */
  padding: number;
  /** Background shown in gaps/padding and behind empty cells. */
  background: string;
}

/** A rectangle in canvas pixels, produced when we walk the tree for layout. */
export interface CellRect {
  id: string;
  node: LeafNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A draggable divider between two children of a split node. */
export interface DividerRect {
  splitId: string;
  axis: Axis; // axis of the parent split; 'x' => vertical divider, 'y' => horizontal
  index: number; // divider sits between child `index` and `index + 1`
  x: number;
  y: number;
  w: number;
  h: number;
  /** Position of the divider line along the split axis, in canvas px. */
  linePos: number;
}
