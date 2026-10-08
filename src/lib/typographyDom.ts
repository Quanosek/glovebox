import { polishTypography } from "./typography";

/**
 * Applies Polish line-breaking rules (`polishTypography`) to every text node
 * rendered on the page, including text added later by React. Manual content
 * is already processed on the server; this covers the interface and the
 * user's own notes and comments. Text is replaced in place, keeping its
 * length, so React updates and highlight offsets are unaffected.
 */

const SKIP = "script,style,textarea,input,code,pre,kbd,[contenteditable]";

function fixNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const next = polishTypography(node.data);
  if (next !== node.data) node.data = next;
}

function fixTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return fixNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if ((root as Element).closest(SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) fixNode(n as Text);
}

/** Starts watching `root`; returns a function that stops it. */
export function watchTypography(root: HTMLElement = document.body) {
  fixTree(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") fixTree(record.target);
      else record.addedNodes.forEach(fixTree);
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return () => observer.disconnect();
}
