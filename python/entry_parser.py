"""Natural-language transaction parser. Mirrors lib/parser.ts so both engines agree."""
from __future__ import annotations

import calendar
import datetime
import math
import re
import time
from typing import Optional

KEYWORDS: dict[str, list[str]] = {
    "Food": ["lunch", "dinner", "breakfast", "coffee", "starbucks", "restaurant", "foodpanda", "food", "jollibee", "mcdo", "grocery", "groceries", "snack", "meal", "milk tea", "merienda", "kape", "ulam", "rice", "pizza", "burger"],
    "Transport": ["grab", "jeep", "jeepney", "fare", "pamasahe", "gas", "gasoline", "taxi", "mrt", "lrt", "bus", "toll", "angkas", "tricycle", "parking", "commute"],
    "Bills": ["electric", "electricity", "water", "internet", "wifi", "rent", "load", "bill", "bills", "subscription", "netflix", "spotify", "meralco", "insurance"],
    "Shopping": ["shopee", "lazada", "clothes", "shoes", "mall", "shirt", "bag", "gift"],
    "Health": ["medicine", "doctor", "gym", "vitamins", "hospital", "dentist", "checkup", "pharmacy"],
    "Fun": ["movie", "game", "games", "concert", "bar", "beer", "inuman", "party", "cinema"],
}

INCOME_RE = re.compile(
    r"\b(salary|sahod|sweldo|received|income|earned|allowance|bonus|refund|deposit|paid me|got paid|freelance)\b"
)
AMOUNT_RE = re.compile(r"(₱\s*|\bphp\s*)?(\d[\d,]*(?:\.\d+)?)(k\b)?")
# A count or unit right after a number ("3 friends", "2 days", "5 pm") is not the price.
COUNT_WORD_RE = re.compile(
    r"^\s*(?:days?|weeks?|months?|years?|hours?|hrs?|mins?|minutes?|pcs?|pieces?|pax|friends?|people|persons?|kids?|items?|orders?|times|am|pm|araw|linggo|buwan|taon)\b"
)
CURRENCY_AFTER_RE = re.compile(r"^\s*(?:php|pesos?|piso)\b")
WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
WEEKDAYS_TL = ["linggo", "lunes", "martes", "miyerkules", "huwebes", "biyernes", "sabado"]
_WD = "|".join(WEEKDAYS + WEEKDAYS_TL)
# Relative date phrases, same as lib/parser.ts. Calendar dates like "nov 10" are not handled here: they depend on the
# user's time zone, which this service cannot know (the browser parser handles them).
DATE_PHRASE_RE = re.compile(
    rf"\b(?:(?:last|on|noong|nung)\s+(?:{_WD})|\d+\s+days?\s+ago|\d+\s+araw\s+(?:ang\s+)?nakaraan|last\s+(?:week|month)"
    r"|nakaraang\s+(?:linggo|buwan)|yesterday|kahapon|tomorrow|bukas|today|kanina|ngayon)\b",
    re.I,
)
FILLER_RE = re.compile(r"\b(bayad|binayad|spent|spend|paid|pay|bought|buy|for|on|from|my|account|using|via|the|sa|ng|ko)\b", re.I)
DAY_MS = 86_400_000
MAX_AMOUNT = 1_000_000_000


def _weekday_index(w: str) -> int:
    return WEEKDAYS.index(w) if w in WEEKDAYS else WEEKDAYS_TL.index(w)


def _find_date(low: str, now_ms: int) -> int:
    """Mirror of findDate() in lib/parser.ts for relative phrases."""
    if re.search(r"\b(yesterday|kahapon)\b", low):
        return now_ms - DAY_MS
    if re.search(r"\b(tomorrow|bukas)\b", low):
        return now_ms + DAY_MS
    ago = re.search(r"\b(\d+)\s+(?:days?\s+ago|araw\s+(?:ang\s+)?nakaraan)\b", low)
    if ago:
        return now_ms - int(ago.group(1)) * DAY_MS
    if re.search(r"\b(last\s+week|nakaraang\s+linggo)\b", low):
        return now_ms - 7 * DAY_MS
    if re.search(r"\b(last\s+month|nakaraang\s+buwan)\b", low):
        d = datetime.datetime.fromtimestamp(now_ms / 1000)
        y, mo = (d.year - 1, 12) if d.month == 1 else (d.year, d.month - 1)
        last = calendar.monthrange(y, mo)[1]
        return int(d.replace(year=y, month=mo, day=min(d.day, last)).timestamp() * 1000)
    wd = re.search(rf"\b(last|on|noong|nung)\s+({_WD})\b", low)
    if wd:
        target = _weekday_index(wd.group(2))
        today = (datetime.datetime.fromtimestamp(now_ms / 1000).weekday() + 1) % 7  # JS-style: Sunday = 0
        back = (today - target + 7) % 7
        if back == 0 and wd.group(1) == "last":
            back = 7
        return now_ms - back * DAY_MS
    return now_ms


def _pick_amount(low: str) -> Optional[tuple[float, int, int]]:
    """Mirror of pickAmount() in lib/parser.ts: (value, start, end) of the price, or None."""
    masked = DATE_PHRASE_RE.sub(lambda d: " " * len(d.group(0)), low)
    best = None  # (marked, value, start, end)
    for m in AMOUNT_RE.finditer(masked):
        start, end = m.start(), m.end()
        before = masked[: start + len(m.group(1) or "")]
        after = masked[end:]
        cur = CURRENCY_AFTER_RE.match(after)
        glued = (
            re.search(r"\bx$", before)
            or re.search(r"[a-z]-$", before)
            or re.match(r"-[a-z]", after)
            or re.search(r"\d[/:]$", before)
            or re.match(r"[/:]\d", after)
            or after.startswith("%")
            or (not m.group(3) and not cur and re.match(r"[a-z]", after) and re.search(r"[^a-z]$", before))
        )
        if glued or COUNT_WORD_RE.match(after):
            continue
        value = float(m.group(2).replace(",", "")) * (1000 if m.group(3) else 1)
        marked = bool(m.group(1))
        if best is None or (marked and not best[0]) or (marked == best[0] and value > best[1]):
            best = (marked, value, start, end + (len(cur.group(0)) if cur else 0))
    if best is None:
        return None
    if not math.isfinite(best[1]) or best[1] >= MAX_AMOUNT:
        return None
    value = round(best[1] * 100) / 100
    if not (0 < value < MAX_AMOUNT):
        return None
    return value, best[2], best[3]


def _find_category(low: str) -> str:
    for cat, words in KEYWORDS.items():
        for w in words:
            if re.search(rf"\b{re.escape(w)}\b", low):
                return cat
    return "Other"


def parse_entry(
    raw: str,
    accounts: list[dict[str, str]],
    def_acc: str,
    now_ms: Optional[int] = None,
) -> Optional[dict]:
    """Return a transaction dict, or None when no amount is found."""
    text = raw.strip()
    if not text:
        return None
    low = text.lower()
    now_ms = int(time.time() * 1000) if now_ms is None else now_ms

    picked = _pick_amount(low)
    if not picked:
        return None
    amount, a_start, a_end = picked
    if float(amount).is_integer():
        amount = int(amount)

    mentions = sorted(
        (
            {"id": a["id"], "name": a["name"], "idx": low.find(a["name"].lower())}
            for a in accounts
        ),
        key=lambda x: x["idx"],
    )
    mentions = [x for x in mentions if x["idx"] >= 0]

    date = _find_date(low, now_ms)

    note = text[:a_start] + " " + text[a_end:]
    note = DATE_PHRASE_RE.sub(" ", note)
    note = re.sub(r"^\s*\+", " ", note)

    if re.search(r"\b(transfer|move|moved)\b", low) and len(mentions) >= 2:
        src, dst = mentions[0], mentions[1]
        fi = low.find(" from ")
        if fi > -1:
            after = [x for x in mentions if x["idx"] > fi]
            if after:
                src = after[0]
                dst = next((x for x in mentions if x["id"] != src["id"]), dst)
        return {
            "type": "transfer", "amount": amount, "acc": src["id"], "to": dst["id"],
            "cat": "Transfer", "note": "Transfer", "date": date,
        }

    is_income = bool(INCOME_RE.search(low)) or bool(re.match(r"^\s*\+", low))
    cat = "Income" if is_income else _find_category(low)
    acc = mentions[0]["id"] if mentions else def_acc

    for a in accounts:
        note = re.sub(rf"\b{re.escape(a['name'])}\b", " ", note, flags=re.I)
    note = FILLER_RE.sub(" ", note)
    note = re.sub(r"\s+", " ", note).strip()
    note = re.sub(r"^[\s\-–—−:;,.₱$]+|[\s\-–—−:;,.₱$]+$", "", note)
    if not note:
        note = "Income" if is_income else cat
    note = note[0].upper() + note[1:]

    return {
        "type": "income" if is_income else "expense", "amount": amount, "acc": acc,
        "cat": cat, "note": note, "date": date,
    }
