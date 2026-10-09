import type { QuickTopicId } from "@/config/quickTopics";

/** Line pictograms of the "Najczęściej potrzebne" tiles (Navi-style keys). */
const PATHS: Record<QuickTopicId, string[]> = {
  tyres: [
    "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z",
    "M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z",
    "M16 16l3.5-3.5",
  ],
  wheel: [
    "M13 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
    "M13 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    "M22 22l6 6M26 22l-4 4",
  ],
  fuses: ["M8 11h16v10H8z", "M4 14h4M4 18h4M24 14h4M24 18h4", "M12 16h8"],
  bulbs: [
    "M16 4a8 8 0 0 0-5 14.2V22h10v-3.8A8 8 0 0 0 16 4Z",
    "M12 25h8M13 28h6",
  ],
  fluids: [
    "M6 20h14l4-6h4",
    "M6 14h10v12H6z",
    "M26 18c0 2-2 3-2 5a2 2 0 0 0 4 0c0-2-2-3-2-5Z",
  ],
  fuel: [
    "M7 27V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v20",
    "M5 27h16M10 9h6v5h-6z",
    "M19 13h3a2 2 0 0 1 2 2v7a2 2 0 0 0 4 0V11l-3-3",
  ],
  indicators: ["M16 5 3 27h26L16 5Z", "M16 13v7M16 23v1"],
  help: [
    "M5 18h22v6H5z",
    "M8 18l3-7h10l3 7",
    "M9 27v-3M23 27v-3",
    "M16 3v4M10 5l2 3M22 5l-2 3",
  ],
  service: ["M7 6h18v22H7z", "M11 4v4M21 4v4M7 12h18", "M11 18l3 3 6-6"],
};

export function TopicIcon({
  id,
  className = "",
}: {
  id: QuickTopicId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
    >
      {PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
