import type { SidebarBook, SidebarNode } from "@/components/Sidebar";
import { BOOKS, getBook, getTocTree, type TocNode } from "@/lib/content";

function toNode(n: TocNode): SidebarNode {
  const node: SidebarNode = { id: n.id, title: n.title, href: n.href };
  if (n.features.length) node.features = n.features;
  if (n.children.length) node.children = n.children.map(toNode);
  return node;
}

/** Compact TOC data for the client sidebar. */
export function getSidebarBooks(): SidebarBook[] {
  return BOOKS.map((b) => ({
    title: getBook(b.id).title,
    href: `/${b.route}`,
    nodes: getTocTree(b.id).map(toNode),
  }));
}
