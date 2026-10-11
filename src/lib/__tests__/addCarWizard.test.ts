// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddCarWizard } from "@/app/dodaj-auto/AddCarWizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/offline", () => ({ useOnline: () => true }));
vi.mock("@/lib/pdfPreview", () => ({
  renderPdfPreview: vi.fn().mockRejectedValue(new Error("Preview unavailable")),
}));
vi.mock("@/lib/storage/hooks", () => ({
  addOwnedCar: vi.fn(),
  setActiveCar: vi.fn(),
}));
vi.mock("@/app/dodaj-auto/ImportSteps", () => ({
  StepDone: () => null,
  StepEquipment: () => null,
  StepProcessing: () => null,
}));

let root: Root;
let container: HTMLDivElement;

async function select(selector: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(selector);
  expect(element).not.toBeNull();
  await act(async () => {
    element!.value = value;
    element!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function typeYear(value: string, blur = false) {
  const element = container.querySelector<HTMLInputElement>("#car-year")!;
  expect(element.tagName).toBe("INPUT");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    if (blur)
      element.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/api/system"
          ? {
              nodeReady: true,
              pythonReady: true,
              extractor: true,
              database: { writable: true },
              localAccess: true,
              runningJob: null,
              limits: { maxDocuments: 10, maxFileBytes: 250 * 1024 * 1024 },
            }
          : url === "/api/catalog/brands"
            ? { brands: [{ id: "SEAT", name: "Seat", popular: true }] }
            : {
                models: [
                  { id: "IBIZA", name: "Ibiza", years: [2010, 2016, 2023] },
                  { id: "ARONA", name: "Arona", years: [2017, 2023] },
                ],
              };
      return { ok: true, json: async () => body };
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(AddCarWizard, { cars: [], minYear: 1950, maxYear: 2027 }),
    );
  });
  await select("#car-brand", "SEAT");
  await select("#car-model", "IBIZA");
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("manual model year", () => {
  it.each([
    ["2008", "other", "Seat", "Ibiza"],
    ["2016", "catalog", "SEAT", "IBIZA"],
  ])(
    "submits year %s with the correct provenance",
    async (year, source, brand, model) => {
      if (source === "other") {
        await select("#car-year", "__other__");
        await typeYear(year);
      } else {
        await select("#car-year", year);
      }
      const input =
        container.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        value: [
          new File(["%PDF-1.7"], "manual.pdf", { type: "application/pdf" }),
        ],
      });
      await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => {});
      const send = vi
        .spyOn(XMLHttpRequest.prototype, "send")
        .mockImplementation(() => {});
      const button = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.startsWith("Dodaj auto i"),
      )!;
      expect(button.disabled).toBe(false);
      await act(async () => button.click());
      const form = send.mock.calls[0][0];
      expect(form).toBeInstanceOf(FormData);
      if (!(form instanceof FormData)) throw new Error("Missing import form");
      expect(
        Object.fromEntries(
          ["source", "brand", "model", "year"].map((key) => [
            key,
            form.get(key),
          ]),
        ),
      ).toEqual({
        source,
        brand,
        model,
        year,
      });
    },
  );

  it("offers 2008 without losing the selected Seat Ibiza", async () => {
    await select("#car-year", "__other__");
    const input = container.querySelector<HTMLInputElement>("#car-year")!;
    expect(input.type).toBe("number");
    expect(input.min).toBe("1950");
    expect(input.max).toBe("2027");
    await typeYear("2008");
    expect(container.querySelector("aside")?.textContent).toContain("Ibiza");
    expect(container.querySelector("aside")?.textContent).toContain("2008");
    expect(
      container.querySelector<HTMLSelectElement>("#car-brand")?.value,
    ).toBe("SEAT");
    expect(
      container.querySelector<HTMLSelectElement>("#car-model")?.value,
    ).toBe("IBIZA");
  });

  it("restores the listed year and resets a manual year on model or brand changes", async () => {
    await select("#car-year", "__other__");
    await typeYear("2008");
    await typeYear("2016", true);
    expect(container.querySelector("input#car-year")).toBeNull();
    await select("#car-year", "__other__");
    await typeYear("2008");
    await select("#car-model", "ARONA");
    expect(container.querySelector("input#car-year")).toBeNull();
    expect(container.querySelector<HTMLSelectElement>("#car-year")?.value).toBe(
      "",
    );
    await select("#car-year", "__other__");
    await typeYear("2008");
    await select("#car-brand", "__other__");
    expect(container.querySelector("input#car-year")).toBeNull();
    expect(container.querySelector<HTMLSelectElement>("#car-year")?.value).toBe(
      "",
    );
  });
});
