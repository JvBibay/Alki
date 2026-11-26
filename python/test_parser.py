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
