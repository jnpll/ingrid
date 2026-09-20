import type {
  Axis,
  CellRect,
  DividerRect,
  GridStyle,
  LayoutNode,
  LeafNode,
  SplitNode,
} from "./types";

let idCounter = 0;
export function uid(prefix = "n"): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter}`;
}

export function newLeaf(): LeafNode {
  return { type: "leaf", id: uid("leaf") };
}

export function initialTree(): LayoutNode {
  return newLeaf();
}

/**
 * Build a near-square grid of `n` empty cells (rows of columns). Used when the
 * user adds more photos at once than the current layout can hold.
 */
export function buildBalancedGrid(n: number): LayoutNode {
  if (n <= 1) return newLeaf();
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const rowNodes: LayoutNode[] = [];
  let remaining = n;
  for (let r = 0; r < rows; r++) {
    const count = Math.min(cols, remaining);
    remaining -= count;
    const leaves = Array.from({ length: count }, () => newLeaf());
    if (count === 1) {
      rowNodes.push(leaves[0]);
    } else {
      rowNodes.push({
        type: "split",
        id: uid("split"),
        axis: "x",
        children: leaves,
        sizes: leaves.map(() => 1 / count),
      });
    }
  }
  if (rowNodes.length === 1) return rowNodes[0];
  return {
    type: "split",
    id: uid("split"),
    axis: "y",
    children: rowNodes,
    sizes: rowNodes.map(() => 1 / rowNodes.length),
  };
}

export interface Canvas {
  w: number;
  h: number;
}

export interface SplitTrack {
  axis: Axis;
  /** Pixel coordinate along the axis where the first child begins. */
  start: number;
  /** Total child length available along the axis, excluding gaps. */
  length: number;
  /** Cross-axis extent (for reference). */
  crossStart: number;
  crossLength: number;
  childCount: number;
}

export interface Geometry {
  cells: CellRect[];
  dividers: DividerRect[];
  splitTracks: Record<string, SplitTrack>;
}

/** Walk the tree and produce pixel rects for cells and dividers. */
export function computeGeometry(
  root: LayoutNode,
  canvas: Canvas,
  style: GridStyle
): Geometry {
  const cells: CellRect[] = [];
  const dividers: DividerRect[] = [];
  const splitTracks: Record<string, SplitTrack> = {};
  const { gap, padding } = style;

  function walk(node: LayoutNode, x: number, y: number, w: number, h: number) {
    if (node.type === "leaf") {
      cells.push({ id: node.id, node, x, y, w, h });
      return;
    }
    const n = node.children.length;
    const along = node.axis === "x" ? w : h;
    const totalGap = gap * (n - 1);
    const trackLen = Math.max(0, along - totalGap);

    splitTracks[node.id] = {
      axis: node.axis,
      start: node.axis === "x" ? x : y,
      length: trackLen,
      crossStart: node.axis === "x" ? y : x,
      crossLength: node.axis === "x" ? h : w,
      childCount: n,
    };

    let cursor = node.axis === "x" ? x : y;
    for (let i = 0; i < n; i++) {
      const len = node.sizes[i] * trackLen;
      if (node.axis === "x") {
        walk(node.children[i], cursor, y, len, h);
      } else {
        walk(node.children[i], x, cursor, w, len);
      }
      // Divider after this child (except the last)
      if (i < n - 1) {
        const linePos = cursor + len + gap / 2;
        const HIT = Math.max(gap, 12);
        if (node.axis === "x") {
          dividers.push({
            splitId: node.id,
            axis: "x",
            index: i,
            x: linePos - HIT / 2,
            y,
            w: HIT,
            h,
            linePos,
          });
        } else {
          dividers.push({
            splitId: node.id,
            axis: "y",
            index: i,
            x,
            y: linePos - HIT / 2,
            w,
            h: HIT,
            linePos,
          });
        }
      }
      cursor += len + gap;
    }
  }

  walk(root, padding, padding, canvas.w - padding * 2, canvas.h - padding * 2);
  return { cells, dividers, splitTracks };
}

// ---- Tree mutations (all return a new tree) ----

function clone(root: LayoutNode): LayoutNode {
  return structuredClone(root);
}

function findNode(
  root: LayoutNode,
  id: string
): { node: LayoutNode; parent: SplitNode | null; index: number } | null {
  if (root.id === id) return { node: root, parent: null, index: -1 };
  if (root.type !== "split") return null;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.id === id) return { node: child, parent: root, index: i };
    const deeper = findNode(child, id);
    if (deeper) return deeper;
  }
  return null;
}

function findSplit(root: LayoutNode, id: string): SplitNode | null {
  if (root.type !== "split") return null;
  if (root.id === id) return root;
  for (const c of root.children) {
    const r = findSplit(c, id);
    if (r) return r;
  }
  return null;
}

/**
 * Split a leaf. dir 'v' creates a vertical divider (children side by side, axis 'x');
 * dir 'h' creates a horizontal divider (children stacked, axis 'y').
 * `before` puts the new empty cell on the left/top instead of right/bottom.
 */
export function splitLeaf(
  root: LayoutNode,
  leafId: string,
  dir: "v" | "h",
  before = false
): LayoutNode {
  const next = clone(root);
  const axis: Axis = dir === "v" ? "x" : "y";
  const found = findNode(next, leafId);
  if (!found || found.node.type !== "leaf") return root;

  const fresh = newLeaf();
  const { parent, index } = found;

  // If the parent split already runs along this axis, insert a sibling and
  // split the dragged cell's share in half so the other siblings keep theirs.
  if (parent && parent.axis === axis) {
    const half = parent.sizes[index] / 2;
    const insertAt = before ? index : index + 1;
    parent.children.splice(insertAt, 0, fresh);
    parent.sizes[index] = half;
    parent.sizes.splice(insertAt, 0, half);
    return next;
  }

  // Otherwise replace the leaf with a new split of [leaf, fresh].
  const newSplit: SplitNode = {
    type: "split",
    id: uid("split"),
    axis,
    children: before ? [fresh, found.node] : [found.node, fresh],
    sizes: [0.5, 0.5],
  };
  if (!parent) return newSplit;
  parent.children[index] = newSplit;
  return next;
}

/** Remove a leaf; redistribute its space and collapse single-child splits. */
export function removeLeaf(root: LayoutNode, leafId: string): LayoutNode {
  const next = clone(root);
  const found = findNode(next, leafId);
  if (!found || !found.parent) return root; // can't remove the root cell
  const parent = found.parent;
  parent.children.splice(found.index, 1);
  parent.sizes.splice(found.index, 1);
  normalize(parent.sizes);
  return collapse(next);
}

/** Collapse any split that has a single child by replacing it with that child. */
function collapse(root: LayoutNode): LayoutNode {
  function rec(node: LayoutNode): LayoutNode {
    if (node.type !== "split") return node;
    node.children = node.children.map(rec);
    if (node.children.length === 1) return node.children[0];
    return node;
  }
  return rec(root);
}

function normalize(sizes: number[]) {
  const sum = sizes.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < sizes.length; i++) sizes[i] /= sum;
}

export function setPhoto(
  root: LayoutNode,
  leafId: string,
  photo: import("./types").Photo | undefined
): LayoutNode {
  const next = clone(root);
  const found = findNode(next, leafId);
  if (found && found.node.type === "leaf") found.node.photo = photo;
  return next;
}

export function updatePhoto(
  root: LayoutNode,
  leafId: string,
  patch: Partial<import("./types").Photo>
): LayoutNode {
  const next = clone(root);
  const found = findNode(next, leafId);
  if (found && found.node.type === "leaf" && found.node.photo) {
    found.node.photo = { ...found.node.photo, ...patch };
  }
  return next;
}

/** Swap the photos held by two leaves (moves content between cells). */
export function swapPhotos(
  root: LayoutNode,
  aId: string,
  bId: string
): LayoutNode {
  if (aId === bId) return root;
  const next = clone(root);
  const a = findNode(next, aId);
  const b = findNode(next, bId);
  if (a && a.node.type === "leaf" && b && b.node.type === "leaf") {
    const tmp = a.node.photo;
    a.node.photo = b.node.photo;
    b.node.photo = tmp;
  }
  return next;
}

export type DropSide = "left" | "right" | "top" | "bottom";

/**
 * Physically move `sourceId` next to `targetId` on the given side. The source
 * cell is lifted out (its old siblings reflow to fill the gap) and re-inserted
 * against the target, which compresses to make room. Returns a new tree.
 */
export function moveCell(
  root: LayoutNode,
  sourceId: string,
  targetId: string,
  side: DropSide
): LayoutNode {
  if (sourceId === targetId) return root;
  const src = findNode(root, sourceId);
  if (!src || src.node.type !== "leaf" || !src.parent) return root; // can't lift the root cell
  const movedPhoto = src.node.photo;

  // 1. Lift the source out; remaining siblings expand to fill its space.
  let next = removeLeaf(root, sourceId);

  // 2. Split the target on the requested side; the fresh half gets the photo.
  const dir: "v" | "h" = side === "left" || side === "right" ? "v" : "h";
  const before = side === "left" || side === "top";
  const beforeIds = new Set(listLeafIds(next));
  next = splitLeaf(next, targetId, dir, before);
  const newId = listLeafIds(next).find((id) => !beforeIds.has(id));
  if (newId) next = setPhoto(next, newId, movedPhoto);
  return next;
}

/**
 * Move `sourceId` to a full-span slot at the canvas edge: a full-height column
 * (left/right) or full-width row (top/bottom), inserted at the root level.
 */
export function moveCellToCanvasEdge(
  root: LayoutNode,
  sourceId: string,
  side: DropSide
): LayoutNode {
  const src = findNode(root, sourceId);
  if (!src || src.node.type !== "leaf" || !src.parent) return root;
  const movedPhoto = src.node.photo;
  const rem = removeLeaf(root, sourceId); // already a fresh clone
  const axis: Axis = side === "left" || side === "right" ? "x" : "y";
  const before = side === "left" || side === "top";
  const fresh: LeafNode = { type: "leaf", id: uid("leaf"), photo: movedPhoto };

  // If the root already runs along this axis, add another full-span child.
  if (rem.type === "split" && rem.axis === axis) {
    const share = 1 / (rem.children.length + 1);
    const scaled = rem.sizes.map((s) => s * (1 - share));
    if (before) {
      rem.children.unshift(fresh);
      scaled.unshift(share);
    } else {
      rem.children.push(fresh);
      scaled.push(share);
    }
    rem.sizes = scaled;
    return rem;
  }

  // Otherwise wrap the whole layout in a new root split.
  const share = rem.type === "leaf" ? 0.5 : 1 / 3;
  return {
    type: "split",
    id: uid("split"),
    axis,
    children: before ? [fresh, rem] : [rem, fresh],
    sizes: before ? [share, 1 - share] : [1 - share, share],
  };
}

/** All leaf ids in visual (depth-first) order. */
export function listLeafIds(root: LayoutNode): string[] {
  const out: string[] = [];
  (function walk(n: LayoutNode) {
    if (n.type === "leaf") out.push(n.id);
    else n.children.forEach(walk);
  })(root);
  return out;
}

/** Leaf ids that currently have no photo, in order. */
export function emptyLeafIds(root: LayoutNode): string[] {
  const out: string[] = [];
  (function walk(n: LayoutNode) {
    if (n.type === "leaf") {
      if (!n.photo) out.push(n.id);
    } else n.children.forEach(walk);
  })(root);
  return out;
}

export interface ResizeOptions {
  shift: boolean;
  /** Minimum child length in px before it pops off. */
  minPx: number;
}

/**
 * Move the divider at `index` of split `splitId` so its center lands at
 * `pointerAlongAxis` (canvas px along the split axis). Returns a new tree.
 */
export function resizeDivider(
  root: LayoutNode,
  canvas: Canvas,
  style: GridStyle,
  splitId: string,
  index: number,
  pointerAlongAxis: number,
  opts: ResizeOptions
): LayoutNode {
  const geo = computeGeometry(root, canvas, style);
  const track = geo.splitTracks[splitId];
  if (!track) return root;
  const { length: L } = track;
  if (L <= 0) return root;
  const { gap } = style;

  const next = clone(root);
  const split = findSplit(next, splitId);
  if (!split) return root;

  const n = split.children.length;
  const lens = split.sizes.map((s) => s * L);

  // Desired cumulative child-length up to and including child `index`.
  const desiredCum =
    pointerAlongAxis - track.start - gap * index - gap / 2;
  const currentCum = lens.slice(0, index + 1).reduce((a, b) => a + b, 0);
  let delta = desiredCum - currentCum;

  const groupA = range(0, index); // children whose total grows by +delta
  const groupB = range(index + 1, n - 1); // total grows by -delta

  // Clamp delta so neither group can be pushed past its available slack.
  const slackA = lens.slice(0, index + 1).reduce((a, b) => a + b, 0);
  const slackB = lens.slice(index + 1).reduce((a, b) => a + b, 0);
  delta = Math.max(-slackA, Math.min(slackB, delta));

  if (opts.shift) {
    distribute(lens, groupA, +delta);
    distribute(lens, groupB, -delta);
  } else {
    lens[index] += delta;
    lens[index + 1] -= delta;
  }

  // Floor tiny/negative values, then pop off anything below the minimum.
  for (let i = 0; i < n; i++) if (lens[i] < 0) lens[i] = 0;
  const survivors: number[] = [];
  const keepChildren: LayoutNode[] = [];
  for (let i = 0; i < n; i++) {
    if (lens[i] >= opts.minPx) {
      survivors.push(lens[i]);
      keepChildren.push(split.children[i]);
    }
    // else: this child popped off
  }
  if (survivors.length === 0) return root; // never delete everything
  split.children = keepChildren;
  split.sizes = survivors;
  normalize(split.sizes);

  return collapse(next);
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/** Add `amount` (can be negative) across indices, weighted by current length. */
function distribute(lens: number[], indices: number[], amount: number) {
  if (indices.length === 0) return;
  const total = indices.reduce((a, i) => a + lens[i], 0);
  if (total <= 0) {
    const each = amount / indices.length;
    for (const i of indices) lens[i] += each;
    return;
  }
  for (const i of indices) lens[i] += amount * (lens[i] / total);
}

// ---- Snapping ----

/**
 * Candidate snap coordinates along `axis` (edges of every cell plus the canvas
 * bounds), excluding edges that belong to the split being dragged.
 */
export function snapCandidates(
  geo: Geometry,
  canvas: Canvas,
  style: GridStyle,
  axis: Axis
): number[] {
  const set = new Set<number>();
  set.add(style.padding);
  set.add((axis === "x" ? canvas.w : canvas.h) - style.padding);
  for (const c of geo.cells) {
    if (axis === "x") {
      set.add(c.x);
      set.add(c.x + c.w);
    } else {
      set.add(c.y);
      set.add(c.y + c.h);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Snap `pos` to the nearest candidate within `threshold`. */
export function applySnap(
  pos: number,
  candidates: number[],
  threshold: number
): { pos: number; snapped: number | null } {
  let best: number | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - pos);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best === null ? { pos, snapped: null } : { pos: best, snapped: best };
}
