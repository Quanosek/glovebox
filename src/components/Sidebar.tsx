"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAvailability } from "@/lib/availability";
import { useAppData, useHydrated, useVehicleProfile } from "@/lib/storage/hooks";
import type { VehicleProfile } from "@/config/vehicle";

export interface SidebarNode {
  id: string;
  title: string;
  href: string;
  features?: string[];
  children?: SidebarNode[];
}

export interface SidebarBook {
  title: string;
  href: string;
  nodes: SidebarNode[];
}

/** Table of contents of both manuals ("books"). */
export function Sidebar({ books, current }: { books: SidebarBook[]; current: string }) {
  const pathname = decodeURIComponent(usePathname());
  const [open, setOpen] = useState(false);
  const profile = useVehicleProfile();
  const hydrated = useHydrated();
  const { settings } = useAppData();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <aside className="border-b border-line bg-paper lg:sticky lg:top-(--header-h) lg:h-[calc(100vh-var(--header-h))] lg:w-80 lg:shrink-0 lg:border-r lg:border-b-0 print:hidden">
      <button
        type="button"
        className="btn btn-ghost w-full justify-between lg:hidden"
        aria-expanded={open}
        aria-controls="toc"
        onClick={() => setOpen((v) => !v)}
      >
        Spis treści <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      <nav
        id="toc"
        ref={navRef}
        aria-label="Spis treści"
        className={`${open ? "block" : "hidden"} max-h-[70vh] overflow-y-auto py-2 lg:block lg:h-full lg:max-h-none`}
      >
        {books.map((book) => (
          <details key={book.href} open={book.href === current} className="group/book">
            <summary className="silver-bar flex cursor-pointer list-none items-center justify-between px-4 py-2 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
              <Link href={book.href} className="hover:text-red" onClick={() => setOpen(false)}>
                {book.title}
              </Link>
              <span aria-hidden="true" className="text-steel group-open/book:rotate-90">
                ›
              </span>
            </summary>
            <ul className="py-1">
              {book.nodes.map((node) => (
                <TocItem
                  key={node.id}
                  node={node}
                  depth={0}
                  pathname={pathname}
                  profile={hydrated ? profile : null}
                  hideMissing={!settings.showUnavailable}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          </details>
        ))}
      </nav>
    </aside>
  );
}

function TocItem({
  node,
  depth,
  pathname,
  profile,
  hideMissing,
  onNavigate,
}: {
  node: SidebarNode;
  depth: number;
  pathname: string;
  profile: VehicleProfile | null;
  hideMissing: boolean;
  onNavigate: () => void;
}) {
  const active = pathname === node.href;
  const inPath = active || pathname.startsWith(`${node.href}/`);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const isOpen = expanded ?? inPath;
  const missing = profile ? getAvailability(node.features ?? [], profile).kind === "missing" : false;
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <li>
      <div
        className={`flex items-stretch border-l-2 ${
          active ? "border-red bg-white" : "border-transparent hover:bg-white"
        }`}
      >
        <Link
          href={node.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`flex-1 py-1.5 pr-2 text-sm leading-snug ${active ? "font-semibold text-ink" : "text-ink"} ${
            missing ? "text-steel" : ""
          }`}
          style={{ paddingLeft: `${0.9 + depth * 0.9}rem` }}
        >
          {node.title}
          {missing && (
            <span className="ml-1.5 align-middle text-[0.625rem] tracking-wide text-red uppercase">
              {hideMissing ? "brak" : "brak w aucie"}
            </span>
          )}
        </Link>
        {hasChildren && (
          <button
            type="button"
            className="w-8 shrink-0 text-steel hover:text-ink"
            aria-label={isOpen ? "Zwiń" : "Rozwiń"}
            aria-expanded={isOpen}
            onClick={() => setExpanded(!isOpen)}
          >
            <span aria-hidden="true" className={`inline-block ${isOpen ? "rotate-90" : ""}`}>
              ›
            </span>
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul>
          {node.children!.map((child) => (
            <TocItem
              key={child.id}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              profile={profile}
              hideMissing={hideMissing}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
