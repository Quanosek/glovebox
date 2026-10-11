// @vitest-environment jsdom
import { act, createElement, Fragment } from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_BY_ID } from "@/config/vehicle";
import { EquipmentEditor } from "@/components/EquipmentEditor";
import { SectionGate } from "@/components/SectionGate";
import { createEmptyData } from "@/lib/storage/schema";
import { getStore } from "@/lib/storage/store";
import type { CarFeatureSections } from "@/lib/cars";

vi.mock("next/navigation", () => ({
  usePathname: () => "/auto/car/manual/section",
}));
vi.mock("@/components/EngineSelector", () => ({
  EngineSelector: () => null,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  getStore().replace(createEmptyData());
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function row(id: string): HTMLLIElement {
  const group = container.querySelector(
    `[role="group"][aria-label="${FEATURE_BY_ID[id].label}"]`,
  );
  if (!group?.closest("li")) throw new Error(`Missing equipment row: ${id}`);
  return group.closest("li")!;
}

function button(id: string, label: string): HTMLButtonElement {
  const found = Array.from(row(id).querySelectorAll("button")).find(
    (element) => element.textContent === label,
  );
  if (!found) throw new Error(`Missing choice: ${id} / ${label}`);
  return found;
}

async function renderPair(first: string, second: string) {
  const sections: CarFeatureSections = Object.fromEntries(
    [first, second].map((id) => [
      id,
      [{ book: "manual", bookShort: "M", title: id, href: "/manual" }],
    ]),
  );
  await act(async () =>
    root.render(
      createElement(
        Fragment,
        null,
        createElement(EquipmentEditor, { carId: "car", engines: [], sections }),
        jsx(SectionGate, {
          features: [second],
          children: createElement("p", { id: "alternative" }, "Alternative"),
        }),
      ),
    ),
  );
}

describe("equipment choices and reader gates", () => {
  it.each([
    ["transmission.automatic", "transmission.manual"],
    ["transmission.manual", "transmission.automatic"],
    ["climate.electronic", "climate.manual"],
    ["climate.manual", "climate.electronic"],
  ])(
    "suggests and collapses %s's alternative %s until confirmed",
    async (first, second) => {
      await renderPair(first, second);
      const content = container.querySelector("#alternative")!;
      expect(content.parentElement?.hidden).toBe(false);
      await act(async () => button(first, "Mam").click());
      expect(button(second, "Nie mam").getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(row(second).textContent).toContain("podpowiedź – potwierdź");
      expect(content.parentElement?.hidden).toBe(true);
      await act(async () => button(first, "Nie wiem").click());
      expect(button(second, "Nie wiem").getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(content.parentElement?.hidden).toBe(false);
      await act(async () => button(first, "Mam").click());
      await act(async () => button(second, "Nie mam").click());
      expect(row(second).textContent).not.toContain("podpowiedź – potwierdź");
      await act(async () => button(first, "Nie wiem").click());
      expect(content.parentElement?.hidden).toBe(true);
      expect(getStore().get().settings.vehicles.car[second]).toEqual({
        status: "no",
        certainty: "confirmed",
      });
    },
  );
});
