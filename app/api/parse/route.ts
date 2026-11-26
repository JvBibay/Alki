import { NextResponse } from "next/server";
import { parseEntry } from "@/lib/parser";
import { clientKey, rateLimit, readJsonLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** A real request is well under 5 KB (300 characters of text and up to 50 account names). */
const MAX_BODY = 16 * 1024;
/** Per caller: a person typing sentences never gets near this. */
const MAX_PER_MINUTE = 40;

interface ParseBody {
  text: string;
  defAcc: string;
  accounts: { id: string; name: string }[];
}

function isValid(b: unknown): b is ParseBody {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  return (
    typeof x.text === "string" &&
    x.text.length <= 300 &&
    typeof x.defAcc === "string" &&
    x.defAcc.length <= 64 &&
    Array.isArray(x.accounts) &&
    x.accounts.length <= 50 &&
    x.accounts.every(
      (a) =>
        a &&
        typeof a === "object" &&
        typeof (a as any).id === "string" &&
        (a as any).id.length <= 64 &&
        typeof (a as any).name === "string" &&
        (a as any).name.length <= 80,
    )
  );
}

/**
 * POST /api/parse
 * Uses the Python FastAPI service when PARSER_URL is set and reachable,
 * otherwise falls back to the TypeScript parser running on Node.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`parse:${clientKey(req)}`, MAX_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const body = await readJsonLimited(req, MAX_BODY);
  if (!isValid(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const base = process.env.PARSER_URL;
  if (base) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body.text, accounts: body.accounts, def_acc: body.defAcc }),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as { result: unknown };
        return NextResponse.json({ result: data.result, engine: "python" });
      }
    } catch {
      /* Python service unavailable: use the built-in parser */
    }
  }

  return NextResponse.json({ result: parseEntry(body.text, body.accounts, body.defAcc), engine: "node" });
}
