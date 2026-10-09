"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_HINT, type LayoutHint } from "@/lib/storage/hint";

const HintContext = createContext<LayoutHint>(EMPTY_HINT);

/** Shares the layout hint read from the cookie by the root layout. */
export function LayoutHintProvider({
  hint,
  children,
}: {
  hint: LayoutHint;
  children: ReactNode;
}) {
  return <HintContext value={hint}>{children}</HintContext>;
}

/**
 * Layout hint for the first paint (server render and hydration). Use it only
 * while `useHydrated()` is false; afterwards read the real data.
 */
export function useLayoutHint(): LayoutHint {
  return useContext(HintContext);
}
