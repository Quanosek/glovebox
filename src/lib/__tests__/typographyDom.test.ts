// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { NBSP } from "@/lib/typography";
import { watchTypography } from "@/lib/typographyDom";

const tick = () => new Promise((r) => setTimeout(r, 0));
let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.body.innerHTML = "";
});

describe("watchTypography", () => {
  it("fixes existing and later added text, but not form fields or code", async () => {
    document.body.innerHTML =
      "<p id='a'>Dach w aucie</p><textarea>a b</textarea><code>i j</code>";
    stop = watchTypography(document.body);
    expect(document.getElementById("a")!.textContent).toBe(
      `Dach w${NBSP}aucie`,
    );
    expect(document.querySelector("textarea")!.value).toBe("a b");
    expect(document.querySelector("code")!.textContent).toBe("i j");

    const p = document.createElement("p");
    p.textContent = "Pilot z kluczykiem";
    document.body.append(p);
    await tick();
    expect(p.textContent).toBe(`Pilot z${NBSP}kluczykiem`);

    p.firstChild!.nodeValue = "Kurtka i czapka";
    await tick();
    expect(p.textContent).toBe(`Kurtka i${NBSP}czapka`);
  });
});
