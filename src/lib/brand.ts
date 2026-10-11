import packageInfo from "../../package.json" with { type: "json" };

/** App name used in titles, the header, the install manifest and outbound requests. */
export const APP_NAME = "Glovebox";
export const APP_VERSION = packageInfo.version;

/** Short Polish description (page metadata and install manifest). */
export const APP_DESCRIPTION =
  "Instrukcje Twoich aut, ich wyposażenie, przypomnienia i notatki – zapisane tylko na Twoim komputerze.";
