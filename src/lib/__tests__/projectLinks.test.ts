import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { ProjectLinks } from "@/components/ProjectLinks";
import {
  APP_NAME,
  APP_REPOSITORY_URL,
  APP_SUPPORT_URL,
  APP_VERSION,
} from "@/lib/brand";

describe("project links", () => {
  it.each([true, false])(
    "shares safe, accessible external links (compact: %s)",
    (compact) => {
      const html = renderToStaticMarkup(
        createElement(ProjectLinks, { compact }),
      );
      expect(APP_REPOSITORY_URL).toBe("https://github.com/Quanosek/glovebox");
      expect(APP_SUPPORT_URL).toBe("https://buycoffee.to/kubaklalo");
      expect(html).toContain(`href="${APP_REPOSITORY_URL}"`);
      expect(html).toContain(`href="${APP_SUPPORT_URL}"`);
      expect(html.match(/target="_blank"/g)).toHaveLength(2);
      expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
      expect(html.match(/aria-label="[^"]+otwiera nową kartę/g)).toHaveLength(
        2,
      );
      expect(html).not.toMatch(/<(?:img|script|iframe)\b/);
      expect(html.includes("<span>Postaw kawę</span>")).toBe(!compact);
      expect(html.includes("<span>GitHub</span>")).toBe(!compact);
      expect(html).toContain("justify-center");
      expect(html).toContain("[&amp;&gt;svg]:shrink-0");
    },
  );

  it("keeps local-data information, branding and the project license in the footer", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    expect(html).toContain(APP_NAME);
    expect(html).toContain(`v${APP_VERSION}`);
    expect(html).toContain(
      "Notatki i ustawienia zapisują się w tej przeglądarce;",
    );
    expect(html).toContain(`${APP_REPOSITORY_URL}/blob/HEAD/LICENSE`);
    expect(html).toContain("GNU AGPL v3.0");
    expect(html).not.toContain("<nav");
    expect(html).not.toMatch(/href="\/(?:notatnik|ustawienia)?"/);
    expect(html).toContain("sekcja 13");
    expect(html).toContain("bez gwarancji");
    expect(html).toContain("Jakub Kłało ©");
    expect(html).toContain('href="https://www.klalo.pl"');
    expect(html).toContain('src="/author-mark.png"');
    expect(readFileSync("public/sw.js", "utf8")).toContain(
      '"/author-mark.png"',
    );
  });

  it("does not place project links in the mobile navigation", () => {
    const header = readFileSync("src/components/Header.tsx", "utf8");
    const navigation = header.slice(header.indexOf("<nav"));
    expect(navigation).not.toContain("ProjectLinks");
    expect(header).toContain('<div className="hidden sm:block">');
  });
});
