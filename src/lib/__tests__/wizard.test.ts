// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddCarWizard } from "@/app/dodaj-auto/AddCarWizard";
import type { CarSummary } from "@/lib/cars";

const { router, addOwnedCar } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
  addOwnedCar: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/offline", () => ({ useOnline: () => true }));
vi.mock("@/lib/pdfPreview", () => ({
  renderPdfPreview: vi.fn().mockRejectedValue(new Error("Preview unavailable")),
}));
vi.mock("@/lib/storage/hooks", () => ({ addOwnedCar, setActiveCar: vi.fn() }));
vi.mock("@/app/dodaj-auto/ImportSteps", () => ({
  StepProcessing: () => createElement("p", null, "Processing"),
  StepEquipment: ({ onNext }: { onNext: () => void }) =>
    createElement("button", { onClick: onNext }, "Equipment"),
  StepDone: ({
    onOpen,
    onProfile,
  }: {
    onOpen: () => void;
    onProfile: () => void;
  }) =>
    createElement(
      "div",
      null,
      createElement("button", { onClick: onOpen }, "Open"),
      createElement("button", { onClick: onProfile }, "Profile"),
    ),
}));

const car: CarSummary = {
  id: "test-car",
  brand: "Test",
  model: "Model",
  year: 2020,
  label: "Test Model 2020",
  href: "/auto/test-car",
  books: ["manual", "radio"].map((id) => ({
    id,
    route: id,
    title: id,
    short: id,
    href: `/auto/test-car/${id}`,
    pages: 12,
    sections: 3,
    placeholder: false,
  })),
};
let container: HTMLDivElement;
let root: Root;
let sent: FormData | undefined;

beforeEach(async () => {
  vi.clearAllMocks();
  sent = undefined;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      responseType = "";
      upload = {};
      status = 202;
      response = {
        job: {
          id: "job",
          carId: car.id,
          label: car.label,
          state: "done",
          docs: [],
          pdfsDeleted: true,
        },
      };
      onload?: () => void;
      open() {}
      send(form: FormData) {
        sent = form;
        this.onload?.();
      }
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/api/system"
          ? {
              nodeReady: true,
              pythonReady: false,
              extractor: false,
              database: { writable: true },
              localAccess: true,
              runningJob: null,
              manuals: { count: 1 },
              limits: { maxDocuments: 10, maxFileBytes: 1000 },
            }
          : url === "/api/catalog/brands"
            ? { brands: [{ id: "test", name: "Test", popular: true }] }
            : url.startsWith("/api/catalog/models")
              ? {
                  models: [{ id: "model", name: "Model", years: [2019, 2020] }],
                }
              : url.endsWith("/features")
                ? { sections: {}, engines: [], year: 2020 }
                : { car };
      return { ok: true, json: async () => body };
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(AddCarWizard, {
        cars: [car],
        minYear: 1950,
        maxYear: 2027,
      }),
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function select(id: string, value: string) {
  await act(async () => {
    const field = container.querySelector<HTMLSelectElement>(`#${id}`)!;
    field.value = value;
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function identifyCar() {
  await select("car-brand", "test");
  await select("car-model", "model");
}

async function typeYear(value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>("#car-year")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("add-car wizard", () => {
  it("shows saved manuals only after identifying a car, saves order and never refreshes mid-wizard", async () => {
    expect(
      container
        .querySelector('[aria-label="Dostępne instrukcje"]')
        ?.closest(".wizard-reveal")
        ?.getAttribute("data-open"),
    ).toBe("false");
    await identifyCar();
    await select("car-year", "2020");
    const list = container.querySelector('[aria-label="Dostępne instrukcje"]')!;
    expect(list.textContent).toContain("manual");
    const drop = container.querySelector(".wizard-drop")!;
    expect(drop.closest(".wizard-reveal")?.getAttribute("data-open")).toBe(
      "false",
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Przesuń dalej: manual"]',
        )!
        .click(),
    );
    const submit = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Dodaj auto"),
    )!;
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(sent?.get("existingCar")).toBe(car.id);
    expect(sent?.getAll("bookOrder")).toEqual(["radio", "manual"]);
    expect(addOwnedCar).toHaveBeenCalledWith(car.id);
    expect(container.textContent).toContain("Equipment");
    expect(router.refresh).not.toHaveBeenCalled();
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent === "Equipment")!
        .click(),
    );
    expect(router.refresh).not.toHaveBeenCalled();
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent === "Open")!
        .click(),
    );
    expect(router.push).toHaveBeenCalledWith(car.href);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("keeps newly picked files visible when identifying a matching saved car", async () => {
    await identifyCar();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["%PDF-1.7"], "new.pdf", { type: "application/pdf" })],
    });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    await select("car-year", "2020");
    expect(
      container
        .querySelector(".wizard-drop")
        ?.closest(".wizard-reveal")
        ?.getAttribute("data-open"),
    ).toBe("true");
    expect(container.querySelector(".wizard-drop")?.textContent).toContain(
      "new.pdf",
    );
  });

  it("replaces Other year with an input and validates a typed listed year as catalogue data", async () => {
    await identifyCar();
    await select("car-year", "__other__");
    expect(container.querySelector("#car-year")?.tagName).toBe("INPUT");
    expect(
      container.querySelector('[aria-label="Wybierz rocznik z listy"]'),
    ).toBeNull();
    expect(container.querySelectorAll("select")).toHaveLength(2);
    await typeYear("2020");
    const submit = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Dodaj auto"),
    )!;
    await act(async () => submit.click());
    expect(sent?.get("source")).toBe("catalog");
    expect(sent?.get("brand")).toBe("test");
    expect(sent?.get("model")).toBe("model");
  });

  it("rejects a fractional or out-of-range year before submission", async () => {
    await identifyCar();
    await select("car-year", "__other__");
    await typeYear("1949");
    expect(container.textContent).toContain("Wpisz rocznik od 1950 do 2027");
    await typeYear("2020.5");
    expect(container.textContent).toContain("Wpisz rocznik od 1950 do 2027");
    expect(sent).toBeUndefined();
  });
});
