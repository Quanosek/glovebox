"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  activeReaderHeading,
  readerOutlineProgress,
  readerOutlineScrollTop,
} from "@/lib/readerProgress";

export interface OutlineHeading {
  id: string;
  label: string;
  level: number;
}

export function SectionOutline({ headings }: { headings: OutlineHeading[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [{ active, atEnd, progress }, setPosition] = useState<{
    active: string | null;
    atEnd: boolean;
    progress: number;
  }>({
    active: null,
    atEnd: false,
    progress: 0,
  });
  const progressStyle: CSSProperties & { "--reader-outline-progress": number } =
    {
      "--reader-outline-progress": progress,
    };

  useEffect(() => {
    const list = listRef.current;
    const content = list
      ?.closest(".reader-grid")
      ?.querySelector<HTMLElement>("[data-highlight-root]");
    if (!list || !content) return;
    const elements = headings.flatMap((heading) => {
      const element = document.getElementById(heading.id);
      return element && content.contains(element) ? [element] : [];
    });
    const header = document.querySelector("header");
    const links = new Map(
      [...list.querySelectorAll<HTMLAnchorElement>("a")].map((link) => [
        link.hash.slice(1),
        link,
      ]),
    );
    let frame = 0;
    const measure = () => {
      frame = 0;
      const visible = elements.filter((el) => el.getClientRects().length > 0);
      const bottom = content.getBoundingClientRect().bottom;
      const positions = visible.map((el) => ({
        id: el.id,
        top: el.getBoundingClientRect().top,
      }));
      const sections = positions.map((position, index) => ({
        ...position,
        bottom: positions[index + 1]?.top ?? bottom,
      }));
      const viewportTop = Math.max(
        0,
        header?.getBoundingClientRect().bottom ?? 0,
      );
      const shown = list.getClientRects().length > 0;
      const current = shown
        ? activeReaderHeading(sections, viewportTop, window.innerHeight)
        : null;
      const finished =
        shown && sections.length > 0 && bottom <= window.innerHeight;
      const link = current ? links.get(current) : undefined;
      const bounds = list.getBoundingClientRect();
      const fill = readerOutlineProgress(
        link ? link.getBoundingClientRect().bottom - bounds.top : null,
        shown ? bounds.height : 0,
      );
      setPosition((previous) =>
        previous.active === current &&
        previous.atEnd === finished &&
        previous.progress === fill
          ? previous
          : { active: current, atEnd: finished, progress: fill },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(content);
    resize.observe(list);
    if (header) resize.observe(header);
    const mutation = new MutationObserver(schedule);
    mutation.observe(content, {
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings]);

  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current="location"]');
    const pane = list?.closest<HTMLElement>("[data-reader-sidebar]");
    if (!list || !pane || (!link && !atEnd)) return;
    let frame = 0;
    const reveal = () => {
      frame = 0;
      if (atEnd) {
        pane.scrollTo({
          top: pane.scrollHeight - pane.clientHeight,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
        return;
      }
      if (!link) return;
      const bounds = pane.getBoundingClientRect();
      const item = link.getBoundingClientRect();
      const top = readerOutlineScrollTop({
        top: item.top - bounds.top + pane.scrollTop,
        bottom: item.bottom - bounds.top + pane.scrollTop,
        scrollTop: pane.scrollTop,
        height: pane.clientHeight,
        scrollHeight: pane.scrollHeight,
      });
      if (Math.abs(top - pane.scrollTop) > 1)
        pane.scrollTo({
          top,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(reveal);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(list);
    resize.observe(pane);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [active, atEnd]);

  return (
    <div>
      <h2 className="section-label mb-2">Na tej stronie</h2>
      <ul
        ref={listRef}
        className="reader-outline space-y-1 text-sm"
        style={progressStyle}
      >
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={active === heading.id ? "location" : undefined}
              data-level={heading.level}
              className={`reader-outline-link ${heading.level === 3 ? "pl-5" : "pl-3"}`}
            >
              <span>{heading.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
