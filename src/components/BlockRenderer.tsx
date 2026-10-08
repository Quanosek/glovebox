import Image from "next/image";
import Link from "next/link";
import type { Block, Run, WarningKind } from "@/content/types";
import { resolvePageRef, type BookCtx } from "@/lib/content";
import { NBSP, polishTypography } from "@/lib/typography";

/** Server component rendering extracted manual blocks. */
export function BlockRenderer({
  ctx,
  blocks,
}: {
  ctx: BookCtx;
  blocks: Block[];
}) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} ctx={ctx} block={block} />
      ))}
    </>
  );
}

const WARNING_STYLE: Record<WarningKind, string> = {
  danger: "border-red bg-white",
  warning: "border-red bg-white",
  caution: "border-graphite bg-paper",
  note: "border-silver bg-paper",
};

function BlockView({ ctx, block }: { ctx: BookCtx; block: Block }) {
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
        <Tag id={block.id}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs ctx={ctx} runs={item} paragraph />
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
        <div id={block.id} className="overflow-x-auto">
          <table>
            {block.header && block.rows.length > 0 && (
              <thead>
                <tr>
                  {block.rows[0].map((cell, i) => (
                    <th key={i}>{polishTypography(cell)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.slice(block.header ? 1 : 0).map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i}>{polishTypography(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <figure id={block.id} className="my-4 border border-line bg-white p-2">
          <Image
            src={block.src}
            width={block.width}
            height={block.height}
            alt={block.alt}
            loading="lazy"
            className="mx-auto h-auto max-h-112 w-auto max-w-full"
          />
          {block.page != null && (
            <figcaption className="mt-1 text-right text-xs text-steel">
              str.{NBSP}
              {block.page}
            </figcaption>
          )}
        </figure>
      );
  }
}

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
        let node: React.ReactNode = typo(run.t, i);
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
