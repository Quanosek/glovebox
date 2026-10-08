import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Inline, type MdBlock } from "@/lib/markdown";

/** Renders notebook Markdown as React elements (see `src/lib/markdown.ts`). */
export function Markdown({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={`prose-note ${className}`}>
      {parseMarkdown(source).map((b, i) => (
        <BlockNode key={i} block={b} />
      ))}
    </div>
  );
}

function BlockNode({ block }: { block: MdBlock }): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = (["h2", "h3", "h4"] as const)[block.level - 1];
      return (
        <Tag>
          <Inlines nodes={block.children} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p>
          <Inlines nodes={block.children} />
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      const tasks = block.items.some((it) => it.checked !== undefined);
      return (
        <Tag className={tasks ? "task-list" : undefined}>
          {block.items.map((it, i) => (
            <li key={i}>
              {it.checked !== undefined && (
                <span
                  aria-label={it.checked ? "zrobione" : "do zrobienia"}
                  role="img"
                  className={`task-box ${it.checked ? "task-box-on" : ""}`}
                />
              )}
              <Inlines nodes={it.children} />
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote>
          {block.children.map((b, i) => (
            <BlockNode key={i} block={b} />
          ))}
        </blockquote>
      );
    case "code":
      return (
        <pre>
          <code>{block.value}</code>
        </pre>
      );
    case "hr":
      return <hr />;
  }
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return (
          <Fragment key={i}>
            {n.value.split("\n").map((part, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {part}
              </Fragment>
            ))}
          </Fragment>
        );
      case "strong":
        return (
          <strong key={i}>
            <Inlines nodes={n.children} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <Inlines nodes={n.children} />
          </em>
        );
      case "del":
        return (
          <del key={i}>
            <Inlines nodes={n.children} />
          </del>
        );
      case "code":
        return <code key={i}>{n.value}</code>;
      case "link": {
        const external = /^(https?:|mailto:)/i.test(n.href);
        return (
          <a
            key={i}
            href={n.href}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            <Inlines nodes={n.children} />
          </a>
        );
      }
    }
  });
}
