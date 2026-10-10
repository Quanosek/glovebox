export interface ReaderHeadingRange {
  id: string;
  top: number;
  bottom: number;
}

export function readerOutlineProgress(
  activeBottom: number | null,
  height: number,
  atEnd: boolean,
): number {
  if (height <= 0) return 0;
  return atEnd ? 1 : Math.min(1, Math.max(0, (activeBottom ?? 0) / height));
}

/** Keep neighbouring headings visible, clamping to reveal the pane's end padding. */
export function readerOutlineScrollTop({
  top,
  bottom,
  scrollTop,
  height,
  scrollHeight,
}: {
  top: number;
  bottom: number;
  scrollTop: number;
  height: number;
  scrollHeight: number;
}): number {
  const margin = Math.min(96, height / 4);
  const target =
    top < scrollTop + margin
      ? top - margin
      : bottom > scrollTop + height - margin
        ? bottom - height + margin
        : scrollTop;
  return Math.max(0, Math.min(target, scrollHeight - height));
}

/** Prefer the most visible part; short parts must be fully visible. */
export function activeReaderHeading(
  sections: ReaderHeadingRange[],
  viewportTop: number,
  viewportBottom: number,
): string | null {
  const height = viewportBottom - viewportTop;
  if (height <= 0) return null;
  const readingLine = viewportTop + height / 3;
  let active: string | null = null;
  let mostVisible = 0;
  let nearest = Infinity;
  for (const section of sections) {
    const visible = Math.max(
      0,
      Math.min(section.bottom, viewportBottom) -
        Math.max(section.top, viewportTop),
    );
    if (
      visible === 0 ||
      visible < Math.min(section.bottom - section.top, height / 3)
    )
      continue;
    const distance = Math.abs(
      Math.max(section.top, Math.min(readingLine, section.bottom)) -
        readingLine,
    );
    if (
      visible > mostVisible ||
      (visible === mostVisible && distance < nearest)
    ) {
      active = section.id;
      mostVisible = visible;
      nearest = distance;
    }
  }
  return active;
}
