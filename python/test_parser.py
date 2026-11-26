from fastapi.testclient import TestClient

from entry_parser import parse_entry
from main import app

ACCOUNTS = [
    {"id": "cash", "name": "Cash"},
    {"id": "gcash", "name": "GCash"},
    {"id": "bank", "name": "Bank"},
]
NOW = 1_794_052_800_000


def test_simple_expense():
    r = parse_entry("lunch 180", ACCOUNTS, "cash", NOW)
    assert (r["type"], r["amount"], r["cat"], r["acc"], r["note"]) == ("expense", 180, "Food", "cash", "Lunch")


def test_named_account_overrides_default():
    r = parse_entry("grab 250 gcash", ACCOUNTS, "cash", NOW)
    assert (r["cat"], r["acc"], r["note"]) == ("Transport", "gcash", "Grab")


def test_income_with_k_suffix():
    r = parse_entry("salary 25k bank", ACCOUNTS, "cash", NOW)
    assert (r["type"], r["amount"], r["acc"]) == ("income", 25000, "bank")


def test_transfer_both_word_orders():
    a = parse_entry("transfer 500 bank to gcash", ACCOUNTS, "cash", NOW)
    b = parse_entry("transfer 500 to gcash from bank", ACCOUNTS, "cash", NOW)
    for r in (a, b):
        assert (r["type"], r["acc"], r["to"]) == ("transfer", "bank", "gcash")


def test_yesterday():
    r = parse_entry("coffee 120 yesterday", ACCOUNTS, "cash", NOW)
    assert r["date"] == NOW - 86_400_000


def test_no_amount():
    assert parse_entry("just coffee", ACCOUNTS, "cash", NOW) is None


def test_http_endpoint():
    client = TestClient(app)
    assert client.get("/health").json() == {"ok": True}
    res = client.post("/parse", json={"text": "jeep 15", "accounts": ACCOUNTS, "def_acc": "cash", "now_ms": NOW})
    assert res.status_code == 200
    assert res.json()["result"]["cat"] == "Transport"
    bad = client.post("/parse", json={"text": "x" * 400, "accounts": ACCOUNTS, "def_acc": "cash"})
    assert bad.status_code == 422


def test_price_is_found_even_when_other_numbers_come_first():
    amt = lambda s: (parse_entry(s, ACCOUNTS, "cash", NOW) or {}).get("amount")
    assert amt("7-eleven 85") == 85
    assert amt("3 shirts 900") == 900
    assert amt("2 coffee 150") == 150
    assert amt("coffee x2 150") == 150
    assert amt("jollibee 2pc chicken 199") == 199
    assert amt("lunch with 3 friends 600") == 600
    assert amt("bought 2 burgers for 240") == 240
    assert amt("pizza 1/2 dozen 300") == 300
    assert amt("2 tickets ₱1,200") == 1200
    assert amt("lunch 180") == 180


def test_no_price_or_absurd_price_is_refused():
    assert parse_entry("7-eleven", ACCOUNTS, "cash", NOW) is None
    assert parse_entry("coffee " + "9" * 400, ACCOUNTS, "cash", NOW) is None
    assert parse_entry("snack 0.001", ACCOUNTS, "cash", NOW) is None


def test_note_has_no_leftover_signs_or_currency():
    note = lambda s: parse_entry(s, ACCOUNTS, "cash", NOW)["note"]
    assert note("lunch 180php") == "Lunch"
    assert note("lunch ₱180") == "Lunch"
    assert note("taxi -50") == "Taxi"
