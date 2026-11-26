"""Natural-language transaction parser. Mirrors lib/parser.ts so both engines agree."""
from __future__ import annotations

import re
import time
from typing import Optional

KEYWORDS: dict[str, list[str]] = {
    "Food": ["lunch", "dinner", "breakfast", "coffee", "food", "jollibee", "mcdo", "grocery", "groceries", "snack", "meal", "milk tea", "merienda", "kape", "ulam", "rice", "pizza", "burger"],
    "Transport": ["grab", "jeep", "jeepney", "fare", "gas", "gasoline", "taxi", "mrt", "lrt", "bus", "toll", "angkas", "tricycle", "parking", "commute"],
    "Bills": ["electric", "electricity", "water", "internet", "wifi", "rent", "load", "bill", "bills", "subscription", "netflix", "spotify", "meralco", "insurance"],
    "Shopping": ["shopee", "lazada", "clothes", "shoes", "mall", "shirt", "bag", "gift"],
    "Health": ["medicine", "doctor", "gym", "vitamins", "hospital", "dentist", "checkup", "pharmacy"],
    "Fun": ["movie", "game", "games", "concert", "bar", "beer", "inuman", "party", "cinema"],
}

INCOME_RE = re.compile(
    r"\b(salary|sahod|sweldo|received|income|earned|allowance|bonus|refund|deposit|paid me|got paid|freelance)\b"
)
AMOUNT_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)(k\b)?")
DAY_MS = 86_400_000


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

    m = AMOUNT_RE.search(low)
    if not m:
        return None
    amount = float(m.group(1).replace(",", "")) * (1000 if m.group(2) else 1)
    if amount <= 0:
        return None
    if amount.is_integer():
        amount = int(amount)

    mentions = sorted(
        (
            {"id": a["id"], "name": a["name"], "idx": low.find(a["name"].lower())}
            for a in accounts
        ),
        key=lambda x: x["idx"],
    )
    mentions = [x for x in mentions if x["idx"] >= 0]

    date = now_ms
    if re.search(r"\b(yesterday|kahapon)\b", low):
        date -= DAY_MS

    note = text[: m.start()] + " " + text[m.end():]
    note = re.sub(r"\b(yesterday|kahapon)\b", " ", note, flags=re.I)
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
    note = re.sub(r"\s+", " ", note).strip()
    if not note:
        note = "Income" if is_income else cat
    note = note[0].upper() + note[1:]

    return {
        "type": "income" if is_income else "expense", "amount": amount, "acc": acc,
        "cat": cat, "note": note, "date": date,
    }
