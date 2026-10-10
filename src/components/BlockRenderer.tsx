import Image from "next/image";
import Link from "next/link";
import type { FeatureId } from "@/config/vehicle";
import type { Block, Run, WarningKind } from "@/content/types";
import {
  getFeatureTree,
  resolvePageRef,
  type BookCtx,
  type FeatureNode,
} from "@/lib/content";
import { NBSP, polishTypography } from "@/lib/typography";
import { AvailabilityBadges } from "./AvailabilityBadges";
import { SectionGate } from "./SectionGate";
import { EngineTable } from "./EngineTable";
import { getManualEngines } from "@/lib/carOverview";

/**
 * Server component rendering extracted manual blocks. Parts under headings
 * that describe optional equipment get availability badges and collapse
 * when the car does not have it (`features` = tags of the whole section).
 */
export function BlockRenderer({
  ctx,
  blocks,
  features = [],
}: {
  ctx: BookCtx;
  blocks: Block[];
  features?: FeatureId[];
}) {
  // The first illustration is usually the largest element on screen.
  const eager = blocks.find((b) => b.type === "image" && !b.icon)?.id;
  return (
    <Nodes
      ctx={ctx}
      nodes={getFeatureTree(ctx, blocks, features)}
      eager={eager}
    />
  );
}

function Nodes({
  ctx,
  nodes,
  eager,
}: {
  ctx: BookCtx;
  nodes: FeatureNode[];
  eager?: string;
}) {
  // Consecutive illustrations share one row and wrap like in the PDF.
  const groups: Array<FeatureNode | FeatureNode[]> = [];
  for (const n of nodes) {
    const figure = n.kind === "block" && isScaledFigure(n.block);
    const last = groups[groups.length - 1];
    if (figure && Array.isArray(last)) last.push(n);
    else groups.push(figure ? [n] : n);
  }
  return groups.map((g) =>
    Array.isArray(g) ? (
      <div
        key={g[0].kind === "block" ? g[0].block.id : undefined}
        className="my-4 flex flex-wrap items-start justify-center gap-4"
      >
        {g.map(
          (n) =>
            n.kind === "block" && (
              <BlockView
                key={n.block.id}
                ctx={ctx}
                block={n.block}
                eager={eager}
              />
            ),
        )}
      </div>
    ) : g.kind === "block" ? (
      <BlockView key={g.block.id} ctx={ctx} block={g.block} eager={eager} />
    ) : (
      <div key={g.heading.id}>
        <BlockView ctx={ctx} block={g.heading} />
        <AvailabilityBadges features={g.features} />
        <SectionGate features={g.features} compact>
          <Nodes ctx={ctx} nodes={g.children} eager={eager} />
        </SectionGate>
      </div>
    ),
  );
}

/** Illustrations with a known page share are shown at one scale per book. */
function isScaledFigure(block: Block): boolean {
  return block.type === "image" && !block.icon && block.share != null;
}

/**
 * Display width of an illustration: its share of the PDF page width times
 * one factor for all books, so a column-wide picture takes a little less than
 * half of the reading column and two fit side by side.
 */
function figureWidth(share: number): string {
  return `${Math.min(100, Math.round(share * 160))}%`;
}

const WARNING_STYLE: Record<WarningKind, string> = {
  danger: "border-red bg-white",
  warning: "border-red bg-white",
  caution: "border-graphite bg-paper",
  note: "border-silver bg-paper",
};

function BlockView({
  ctx,
  block,
  eager,
}: {
  ctx: BookCtx;
  block: Block;
  eager?: string;
}) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h2" | "h3" | "h4";
      return (
        <Tag id={block.id}>
          <Runs ctx={ctx} runs={block.runs} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p id={block.id}>
          <Runs ctx={ctx} runs={block.runs} paragraph />
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          id={block.id}
          className={block.markers ? "list-none pl-0" : undefined}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              className={block.markers ? "flex items-start gap-2" : undefined}
            >
              {block.markers && (
                <span
                  aria-hidden="true"
                  className="inline-block min-w-3 shrink-0 text-center"
                  style={{ color: block.markers[i]?.color }}
                >
                  {block.markers[i]?.glyph ?? "•"}
                </span>
              )}
              <span>
                <Runs ctx={ctx} runs={item} paragraph />
              </span>
            </li>
          ))}
        </Tag>
      );
    }
    case "warning":
      return (
        <aside
          id={block.id}
          className={`my-4 border-y border-r border-l-4 border-y-line border-r-line px-4 py-2 ${WARNING_STYLE[block.kind]}`}
          aria-label={block.title}
        >
          <p
            className={`my-1! flex items-center gap-2 text-[0.8em] font-bold tracking-[0.08em] uppercase ${
              block.kind === "danger" || block.kind === "warning"
                ? "text-red"
                : "text-graphite"
            }`}
          >
            <WarningIcon kind={block.kind} />
            {polishTypography(block.title)}
          </p>
          {block.blocks.map((b) => (
            <BlockView key={b.id} ctx={ctx} block={b} />
          ))}
        </aside>
      );
    case "table":
      return (
        <EngineTable
          carId={ctx.car.id}
          block={block}
          engines={getManualEngines(ctx.car)}
          cellNodes={block.cells?.map((row) =>
            row.map((runs, c) => <Runs key={c} ctx={ctx} runs={runs} />),
          )}
        />
      );
    case "image":
      if (block.icon) {
        return (
          <Image
            id={block.id}
            src={block.src}
            width={block.width}
            height={block.height}
            alt={block.alt}
            className="mr-2 inline-block h-[1.6em] w-auto align-middle"
          />
        );
      }
      return (
        <figure
          id={block.id}
          className={`border border-line bg-white p-2 ${
            block.share != null ? "w-full sm:w-(--figure-width)" : "my-4"
          }`}
          style={
            block.share != null
              ? ({
                  "--figure-width": figureWidth(block.share),
                } as React.CSSProperties)
              : undefined
          }
        >
          <Image
            src={block.src}
            width={block.width}
            height={block.height}
            alt={block.alt}
            loading={block.id === eager ? "eager" : "lazy"}
            className={
              block.share != null
                ? "h-auto w-full"
                : "mx-auto h-auto max-h-112 w-auto max-w-full"
            }
          />
          {(block.caption || block.page != null) && (
            <figcaption className="mt-1 flex items-baseline justify-between gap-2 text-xs text-graphite">
              <span>
                {block.caption && <Runs ctx={ctx} runs={block.caption} />}
              </span>
              {block.page != null && (
                <span className="shrink-0 text-steel">
                  str.{NBSP}
                  {block.page}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      );
  }
}

/**
 * Pictogram inside a sentence: as tall as the text, centred on the line,
 * with a little space on both sides.
 */
const INLINE_SYMBOL_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: "auto",
  height: "1.2em",
  margin: "0 0.15em",
  verticalAlign: "middle",
};

/**
 * Renders text runs with Polish line-breaking rules. In a whole paragraph
 * (`paragraph`) the last text run also keeps a short final word on the line
 * before, so no paragraph ends with a lone word.
 */
function Runs({
  ctx,
  runs,
  paragraph = false,
}: {
  ctx: BookCtx;
  runs: Run[];
  paragraph?: boolean;
}) {
  const last = runs.length - 1;
  const typo = (text: string, i: number) =>
    polishTypography(text, { lastWord: paragraph && i === last });
  return (
    <>
      {runs.map((run, i) => {
        if (typeof run === "string") return typo(run, i);
        if ("page" in run) {
          const href = resolvePageRef(ctx, run.page);
          const label = `str.${NBSP}${run.page}`;
          return href ? (
            <Link key={i} href={href} className="page-ref">
              {label}
            </Link>
          ) : (
            <span key={i} className="text-steel">
              {label}
            </span>
          );
        }
        if ("icon" in run) {
          // Inline styles: the symbol must sit in the line even before (or
          // without) the stylesheet, which makes images blocks by default.
          return (
            <Image
              key={i}
              src={run.icon}
              width={run.w}
              height={run.h}
              alt="symbol"
              className="inline-symbol"
              style={INLINE_SYMBOL_STYLE}
            />
          );
        }
        let node: React.ReactNode = run.href ? (
          <a
            href={run.href}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            {run.t}
          </a>
        ) : (
          typo(run.t, i)
        );
        if (run.i) node = <em>{node}</em>;
        if (run.b) node = <strong>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

function WarningIcon({ kind }: { kind: WarningKind }) {
  if (kind === "note") {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M10 8.5V14M10 5.5v1.2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M10 2 19 18H1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 7.5V12.5M10 14.3v1.4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
