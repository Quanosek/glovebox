/**
 * Maps between DOM positions and character offsets in the concatenated text
 * of a container. Text inside elements marked with `data-anchor-ignore`
 * (badges, buttons, …) is skipped so offsets depend on manual text only.
 */

export const IGNORE_ATTR = "data-anchor-ignore";

export function textNodes(root: Node): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent && parent.closest(`[${IGNORE_ATTR}]`)) {
        return root.contains(parent.closest(`[${IGNORE_ATTR}]`))
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const out: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

export function containerText(root: Node): string {
  return textNodes(root)
    .map((n) => n.data)
    .join("");
}

/** Converts a DOM boundary point into a text offset (or null if outside). */
export function offsetOf(root: Node, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null;
  const nodes = textNodes(root);
  let total = 0;
  if (node.nodeType === Node.TEXT_NODE) {
    for (const t of nodes) {
      if (t === node) return total + Math.min(offset, t.data.length);
      total += t.data.length;
    }
    // Text node inside an ignored element: snap to the nearest text after it.
    return snapAfter(root, nodes, node);
  }
  // Element boundary: the position before child `offset`.
  const child = node.childNodes[offset] ?? null;
  for (const t of nodes) {
    if (child && (child === t || child.contains(t) || precedes(child, t))) return total;
    if (!child && !node.contains(t) && precedes(node, t)) return total;
    total += t.data.length;
  }
  return total;
}

function precedes(a: Node, b: Node): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function snapAfter(root: Node, nodes: Text[], node: Node): number {
  let total = 0;
  for (const t of nodes) {
    if (precedes(node, t)) return total;
    total += t.data.length;
  }
  return total;
}

/** Creates a DOM Range for text offsets [start, end). */
export function rangeFromOffsets(root: Node, start: number, end: number): Range | null {
  const nodes = textNodes(root);
  const doc = root.ownerDocument ?? (root as Document);
  let total = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  for (const t of nodes) {
    const len = t.data.length;
    if (!startNode && start < total + len) {
      startNode = t;
      startOffset = start - total;
    }
    if (startNode && end <= total + len) {
      const range = doc.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(t, end - total);
      return range;
    }
    total += len;
  }
  return null;
}

/** Text offsets of a DOM range relative to `root`, or null if outside. */
export function offsetsOfRange(root: Node, range: Range): { start: number; end: number } | null {
  const start = offsetOf(root, range.startContainer, range.startOffset);
  const end = offsetOf(root, range.endContainer, range.endOffset);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}
