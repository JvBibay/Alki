"""Kwenta parser service (FastAPI).

Run:  uvicorn main:app --port 8000
"""
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from entry_parser import parse_entry

app = FastAPI(title="Kwenta parser", version="0.1.0")


class Account(BaseModel):
    id: str
    name: str


class ParseRequest(BaseModel):
    text: str = Field(max_length=300)
    accounts: list[Account] = Field(max_length=50)
    def_acc: str
    now_ms: Optional[int] = None


class ParseResponse(BaseModel):
    result: Optional[dict]


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/parse", response_model=ParseResponse)
def parse(req: ParseRequest) -> ParseResponse:
    accounts = [a.model_dump() for a in req.accounts]
    return ParseResponse(result=parse_entry(req.text, accounts, req.def_acc, req.now_ms))
