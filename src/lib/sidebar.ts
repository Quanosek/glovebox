import type { SidebarBook, SidebarNode } from "@/components/Sidebar";
import { bookHref, type CarFile } from "@/lib/cars";
import { bookCtxs, getBook, getTocTree, type TocNode } from "@/lib/content";

function toNode(n: TocNode): SidebarNode {
  const node: SidebarNode = { id: n.id, title: n.title, href: n.href };
  if (n.features.length) node.features = n.features;
  if (n.children.length) node.children = n.children.map(toNode);
  return node;
}

/** Compact TOC data of every book of a car for the client sidebar. */
export function getSidebarBooks(car: CarFile): SidebarBook[] {
  return bookCtxs(car).map((ctx) => ({
    title: getBook(ctx).title,
    href: bookHref(car.id, ctx.book.route),
    nodes: getTocTree(ctx).map(toNode),
  }));
}
