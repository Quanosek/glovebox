"""Polish text helpers and the patterns shared by all extraction steps."""

from __future__ import annotations

import re
import unicodedata

WARNING_LABELS = {
    "niebezpieczeństwo": ("danger", "Niebezpieczeństwo"),
    "ostrzeżenie": ("warning", "Ostrzeżenie"),
    "przestroga": ("caution", "Przestroga"),
    "ostrożnie": ("caution", "Ostrożnie"),
    "uwaga": ("note", "Uwaga"),
    "informacja": ("note", "Informacja"),
}

# Sentinel used for arrow glyphs that introduce page references.
REF_MARK = "\u21d2"
# Sentinel for an inline pictogram (a glyph of a symbol font rendered as an icon).
ICON_MARK = "\ue000"
# "›››" introduces references in some manuals ("››› strona 45", "››› rys. 3").
TEXT_ARROWS = "→⇒⇨➜➔➞►▶›"
# Direction marks, zero-width spaces and joiners carried by some outlines and texts.
INVISIBLE = "\u200b\u200c\u200d\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2060\u2066\u2067\u2068\u2069\ufeff"
INVISIBLE_RE = re.compile("[" + INVISIBLE + "]")
# Bullet glyphs may touch the text ("■Centralny zamek"); dashes need a space.
BULLET_RE = re.compile(r"^([■●•▪◆○◦](?=\s*\S)|[\u2013\u2014\-](?=\s))\s*")
MARKER_ONLY_RE = re.compile(r"^(?:[■●•▪◆○◦\u2013\u2014\-]|\d{1,2}[.)])$")
ORDERED_RE = re.compile(r"^(\d{1,2})[.)]\s+")
# Footnote marks: "1) COC = …", "¹⁾ Zastrzeżony znak…".
FOOTNOTE_RE = re.compile(r"^(?:\d{1,2}\)|[¹²³⁴⁵⁶⁷⁸⁹]+⁾?)\s*\S")
# "⇒ 45", "››› strona 45", "››› ⚠ zob. Opis na stronie 45" (the words before
# "strona" are kept as text, the page number becomes a reference).
REF_RE = re.compile(
    REF_MARK
    + r"[\s"
    + REF_MARK
    + r"]*(?:(?P<lead>[^\d"
    + REF_MARK
    + r"]{0,120}?)(?<!\w)(?i:stronie|strona|str\.)\s*)?(?P<first>\d{1,3})(?!\d)(?P<more>(?:\s*(?:,|i|oraz)\s*\d{1,3}(?!\d))*)"
)
# Table-of-contents lines with dot leaders ("Kluczyki ........ 22").
# "W górę : podnoszenie siedziska", "INT = praca przerywana" (a short term,
# a spaced colon or an equals sign, a description).
DEFINITION_RE = re.compile(r"^[^:=]{1,30}(?:\s:|\s?=)\s+\S")
# Dots before a page number: "........ 22", ". . 138", "… 70", " . 224".
LEADER_DOTS = r"(?:(?:\s?\.){2,}|\s?…[.…]*|\s\.)"
LEADER_RE = re.compile(r"(?<![\d.…])" + LEADER_DOTS + r"\s*\d{1,3}\s*$|\.{6,}")
SENTENCE_END = (".", ":", "!", "?", ";")
# Internet addresses printed in manuals ("https://www.seat.com/…", "www.opel.pl").
URL_START_RE = re.compile(r"(?:https?://|www\.)", re.I)
URL_RE = re.compile(r"(?<![\w@/])(?:https?://|www\.)[^\s<>\"„”“]*[^\s<>\"„”“.,;:!?)\]]", re.I)
POLISH_LETTERS = "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ"

POLISH_TRANSLIT = str.maketrans(
    {
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n",
        "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    }
)


# --------------------------------------------------------------------------
# Small text helpers (unit tested in scripts/tests)
# --------------------------------------------------------------------------


def slugify(text: str, max_len: int = 60) -> str:
    text = text.lower().translate(POLISH_TRANSLIT)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(text) > max_len:
        text = text[:max_len].rsplit("-", 1)[0] or text[:max_len]
    return text or "sekcja"


def normalize_title(text: str) -> str:
    """Comparable form of a title: the outline and the printed heading may
    differ in optional-equipment asterisks ("Climatronic* sterowanie"),
    footnote marks ("Nawigacja¹⁾"), quotes, pictograms and spacing."""
    text = INVISIBLE_RE.sub("", text.replace("\u00ad", "").replace(REF_MARK, ""))
    text = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹]+⁾|[\ue000-\uf8ff*„“”\"«»]", "", text)
    # NFKC: "CO₂" in the text matches "CO2" in the outline.
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    text = re.sub(r"\s*/\s*", "/", text)
    text = re.sub(r"\s+([?!.,:;)])", r"\1", text)
    return text.rstrip(" .:")


def join_line_texts(prev: str, nxt: str) -> tuple[str, str]:
    """Return (prev_fixed, separator) used to join two consecutive lines.

    Handles hyphenation: "zamy-" + "kanie" -> "zamykanie", while compound
    words keep the hyphen: "Start-" + "Stop" -> "Start-Stop".
    """
    stripped = prev.rstrip()
    if stripped.endswith("\u00ad"):
        return stripped[:-1], ""
    words = stripped.split()
    if words and URL_START_RE.match(words[-1]) and stripped.endswith(("/", ".", "-", "_", "=", "?", "&", "#")) and nxt.strip()[:1].isalnum():
        return stripped, ""  # an address broken at the end of a line
    if stripped.endswith(("-", "\u2010")) and len(stripped) >= 2 and stripped[-2].isalpha():
        first = nxt.lstrip()[:1]
        if first and first.islower():
            return stripped[:-1], ""
        return stripped[:-1] + "-", ""
    return stripped, " "


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = INVISIBLE_RE.sub("", text.replace("\u00ad", "").replace("\ufb01", "fi").replace("\ufb02", "fl"))
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    return text.strip()
