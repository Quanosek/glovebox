"""Inline runs of the content format (`src/content/types.ts`): plain text,
bold / italic text, page references and inline pictograms."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from typing import Any

from .model import Item, Span
from .text import ICON_MARK, REF_MARK, REF_RE, URL_RE, join_line_texts


def build_runs(chars: list[tuple[Any, ...]]) -> list[Any]:
    """Convert styled characters into JSON runs; resolve page references.

    Every item is `(char, bold, italic)` or `(ICON_MARK, bold, italic, run)`
    for an inline pictogram (`run` = `{"icon": src, "w": …, "h": …}`).
    """
    text = "".join(c[0] for c in chars)
    runs: list[Any] = []

    def push(segment: list[tuple[Any, ...]]) -> None:
        buf = ""
        style: tuple[bool, bool] | None = None
        for item in segment:
            ch, b, i = item[0], item[1], item[2]
            if ch == REF_MARK:
                continue
            if ch == ICON_MARK:
                if buf:
                    emit(buf, style or (False, False))
                buf, style = "", None
                if len(item) > 3 and item[3]:
                    runs.append(dict(item[3]))
                continue
            if style is not None and (b, i) != style and ch != " ":
                emit(buf, style)
                buf = ""
                style = (b, i)
            if style is None:
                style = (b, i)
            buf += ch
        if buf:
            emit(buf, style or (False, False))

    def emit(buf: str, style: tuple[bool, bool]) -> None:
        if not buf:
            return
        b, i = style
        if not b and not i:
            if runs and isinstance(runs[-1], str):
                runs[-1] += buf
            else:
                runs.append(buf)
            return
        run: dict[str, Any] = {"t": buf}
        if b:
            run["b"] = True
        if i:
            run["i"] = True
        prev = runs[-1] if runs else None
        if isinstance(prev, dict) and "t" in prev and prev.get("b") == run.get("b") and prev.get("i") == run.get("i"):
            prev["t"] += buf
        else:
            runs.append(run)

    pos = 0
    for m in REF_RE.finditer(text):
        push(chars[pos : m.start()])
        if m.group("lead"):
            # Words between the arrow and "strona" ("zob. Opis na") stay text.
            push(chars[m.start("lead") : m.end("lead")])
        numbers = [int(m.group("first"))] + [int(n) for n in re.findall(r"\d{1,3}", m.group("more") or "")]
        for idx, n in enumerate(numbers):
            if idx:
                emit(", ", (False, False))
            runs.append({"page": n})
        pos = m.end()
    push(chars[pos:])

    # Collapse whitespace across runs and trim the ends.
    out: list[Any] = []
    for r in runs:
        if isinstance(r, str):
            r = re.sub(r"\s+", " ", r)
        elif "t" in r:
            r["t"] = re.sub(r"\s+", " ", r["t"])
        out.append(r)
    out = linkify(out)
    # Spaces after a bold / italic phrase belong to the plain text.
    for k in range(len(out) - 1):
        r, nxt = out[k], out[k + 1]
        if isinstance(r, dict) and r.get("t", "").endswith(" ") and r["t"].strip() and isinstance(nxt, str):
            r["t"] = r["t"].rstrip()
            out[k + 1] = " " + nxt.lstrip()
    while out and run_text(out[0]).strip() == "" and not is_ref(out[0]) and not is_icon(out[0]):
        out.pop(0)
    while out and run_text(out[-1]).strip() == "" and not is_ref(out[-1]) and not is_icon(out[-1]):
        out.pop()
    if out:
        out[0] = with_text(out[0], run_text(out[0]).lstrip())
        out[-1] = with_text(out[-1], run_text(out[-1]).rstrip())
    return out


def linkify(runs: list[Any]) -> list[Any]:
    """Internet addresses in text runs become link runs (`{"t", "href"}`)."""
    out: list[Any] = []
    for r in runs:
        text = r if isinstance(r, str) else r.get("t") if "t" in r and "href" not in r else None
        if not text or not URL_RE.search(text):
            out.append(r)
            continue
        style = {k: v for k, v in r.items() if k in ("b", "i")} if isinstance(r, dict) else {}
        pos = 0
        for m in URL_RE.finditer(text):
            if m.start() > pos:
                out.append({"t": text[pos : m.start()], **style} if style else text[pos : m.start()])
            url = m.group(0)
            href = url if re.match(r"https?://", url, re.I) else f"https://{url}"
            out.append({"t": url, "href": href, **style})
            pos = m.end()
        if pos < len(text):
            out.append({"t": text[pos:], **style} if style else text[pos:])
    return out


def is_ref(run: Any) -> bool:
    return isinstance(run, dict) and "page" in run


def is_icon(run: Any) -> bool:
    return isinstance(run, dict) and "icon" in run


def run_text(run: Any) -> str:
    if isinstance(run, str):
        return run
    return run.get("t", "")


def with_text(run: Any, text: str) -> Any:
    if isinstance(run, str):
        return text
    if "t" in run:
        run["t"] = text
    return run


def runs_to_text(runs: list[Any]) -> str:
    return "".join(f"str. {r['page']}" if is_ref(r) else run_text(r) for r in runs)


def join_runs(head: list[Any], tail: list[Any]) -> list[Any]:
    """Append the runs of a wrapped line, de-hyphenating at the join."""
    if not head:
        return tail
    if not tail:
        return head
    out = list(head)
    last, first = out[-1], tail[0]
    if isinstance(last, str) and isinstance(first, str):
        fixed, sep = join_line_texts(last, first)
        out[-1] = fixed + sep + first.lstrip()
        return out + tail[1:]
    if isinstance(last, str):
        fixed, sep = join_line_texts(last, run_text(first) or "x")
        out[-1] = fixed + sep
    else:
        out.append(" ")
    return out + tail


def without_bold(runs: list[Any]) -> list[Any]:
    """Runs of a heading: headings are bold by themselves."""
    out: list[Any] = []
    for r in runs:
        if isinstance(r, dict):
            r.pop("b", None)
            if set(r) == {"t"}:
                r = r["t"]
        out.append(r)
    return out


def lines_to_runs(lines: list[Item], icon: Callable[[Item, Span], dict[str, Any] | None]) -> list[Any]:
    """Runs of consecutive lines read as one text (de-hyphenated); `icon`
    renders an inline pictogram span into an icon run."""
    chars: list[tuple[Any, ...]] = []
    for ln in lines:
        line_chars: list[tuple[Any, ...]] = []
        for s in ln.spans:
            if s.icon:
                line_chars.append((ICON_MARK, False, False, icon(ln, s)))
            else:
                line_chars.extend((ch, s.bold, s.italic) for ch in s.text)
        line_text = "".join(c[0] for c in line_chars)
        if chars:
            prev_text = "".join(c[0] for c in chars)
            fixed, sep = join_line_texts(prev_text, line_text)
            chars = chars[: len(fixed)]
            if sep:
                chars.append((sep, False, False))
            lead = len(line_text) - len(line_text.lstrip())
            line_chars = line_chars[lead:]
        chars.extend(line_chars)
    chars = [(unicodedata.normalize("NFC", c[0]),) + tuple(c[1:]) for c in chars]
    return build_runs(chars)
