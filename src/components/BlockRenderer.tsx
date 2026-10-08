import Image from "next/image";
import Link from "next/link";
import type { Block, BookId, Run, WarningKind } from "@/content/types";
import { resolvePageRef } from "@/lib/content";

/** Server component rendering extracted manual blocks. */
export function BlockRenderer({
  book,
  blocks,
}: {
  book: BookId;
  blocks: Block[];
}) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} book={book} block={block} />
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

function BlockView({ book, block }: { book: BookId; block: Block }) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h2" | "h3" | "h4";
      return (
        <Tag id={block.id}>
          <Runs book={book} runs={block.runs} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p id={block.id}>
          <Runs book={book} runs={block.runs} />
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag id={block.id}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs book={book} runs={item} />
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
            {block.title}
          </p>
          {block.blocks.map((b) => (
            <BlockView key={b.id} book={book} block={b} />
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
                    <th key={i}>{cell}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.slice(block.header ? 1 : 0).map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i}>{cell}</td>
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
            className="mx-auto h-auto max-h-[28rem] w-auto max-w-full"
          />
          {block.page != null && (
            <figcaption className="mt-1 text-right text-xs text-steel">
              str. {block.page}
            </figcaption>
          )}
        </figure>
      );
  }
}

function Runs({ book, runs }: { book: BookId; runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) => {
        if (typeof run === "string") return run;
        if ("page" in run) {
          const href = resolvePageRef(book, run.page);
          const label = `str. ${run.page}`;
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
        let node: React.ReactNode = run.t;
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
