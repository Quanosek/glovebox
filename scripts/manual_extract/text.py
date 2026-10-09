"""Polish text helpers and the patterns shared by all extraction steps."""

from __future__ import annotations

import re
import unicodedata

WARNING_LABELS = {
    "niebezpieczeństwo": ("danger", "Niebezpieczeństwo"),
    "ostrzeżenie": ("warning", "Ostrzeżenie"),
    "przestroga": ("caution", "Przestroga"),
    "uwaga": ("note", "Uwaga"),
}

# Sentinel used for arrow glyphs that introduce page references.
REF_MARK = "\u21d2"
# Sentinel for an inline pictogram (a glyph of a symbol font rendered as an icon).
ICON_MARK = "\ue000"
TEXT_ARROWS = "→⇒⇨➜➔➞►▶"
# Bullet glyphs may touch the text ("■Centralny zamek"); dashes need a space.
BULLET_RE = re.compile(r"^([■●•▪◆○◦](?=\s*\S)|[\u2013\u2014\-](?=\s))\s*")
MARKER_ONLY_RE = re.compile(r"^(?:[■●•▪◆○◦\u2013\u2014\-]|\d{1,2}[.)])$")
ORDERED_RE = re.compile(r"^(\d{1,2})[.)]\s+")
REF_RE = re.compile(REF_MARK + r"\s*(\d{1,3})((?:\s*(?:,|i|oraz)\s*\d{1,3})*)")
# Table-of-contents lines with dot leaders ("Kluczyki ........ 22").
# "W górę : podnoszenie siedziska", "INT = praca przerywana" (a short term,
# a spaced colon or an equals sign, a description).
DEFINITION_RE = re.compile(r"^[^:=]{1,30}(?:\s:|\s?=)\s+\S")
# Dots before a page number: "........ 22", ". . 138", "… 70", " . 224".
LEADER_DOTS = r"(?:(?:\s?\.){2,}|\s?…[.…]*|\s\.)"
LEADER_RE = re.compile(r"(?<![\d.…])" + LEADER_DOTS + r"\s*\d{1,3}\s*$|\.{6,}")
SENTENCE_END = (".", ":", "!", "?", ";")

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
    # NFKC: "CO₂" in the text matches "CO2" in the outline.
    text = unicodedata.normalize("NFKC", text.replace("\u00ad", "").replace(REF_MARK, ""))
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text.rstrip(" .:")


def join_line_texts(prev: str, nxt: str) -> tuple[str, str]:
    """Return (prev_fixed, separator) used to join two consecutive lines.

    Handles hyphenation: "zamy-" + "kanie" -> "zamykanie", while compound
    words keep the hyphen: "Start-" + "Stop" -> "Start-Stop".
    """
    stripped = prev.rstrip()
    if stripped.endswith("\u00ad"):
        return stripped[:-1], ""
    if stripped.endswith(("-", "\u2010")) and len(stripped) >= 2 and stripped[-2].isalpha():
        first = nxt.lstrip()[:1]
        if first and first.islower():
            return stripped[:-1], ""
        return stripped[:-1] + "-", ""
    return stripped, " "


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\u00ad", "").replace("\ufb01", "fi").replace("\ufb02", "fl")
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    return text.strip()
