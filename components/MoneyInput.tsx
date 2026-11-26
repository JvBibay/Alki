"use client";

import { InputHTMLAttributes, useLayoutEffect, useRef } from "react";
import { cleanMoney, formatMoneyTyping } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { getBaseCurrency } from "@/lib/format";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Plain number text without commas, e.g. "25000.5" (or "" when empty). */
  value: string;
  onChange: (raw: string) => void;
  /** Currency code for the symbol and decimals; defaults to the main currency. */
  currency?: string;
};

/**
 * Peso amount field: shows a ₱ sign and adds commas as you type (25,000.50),
 * while giving the app a plain number string. Opens the number keypad on phones.
 */
export default function MoneyInput({ value, onChange, currency, className = "", ...rest }: Props) {
  const cur = getCurrency(currency || getBaseCurrency());
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const display = formatMoneyTyping(value);

  // Keep the cursor in the same place among the digits when commas are added or removed.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    let seen = 0;
    let pos = display.length;
    for (let i = 0; i < display.length; i++) {
      if (seen === caret.current) {
        pos = i;
        break;
      }
      if (/[\d.]/.test(display[i])) seen++;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, [display]);

  return (
    <span className={`money ${className}`}>
      <span className="peso" aria-hidden="true">
        {cur.symbol.trim()}
      </span>
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        onChange={(e) => {
          const el = e.target;
          const before = el.value.slice(0, el.selectionStart ?? el.value.length);
          caret.current = (before.match(/[\d.]/g) ?? []).length;
          onChange(cleanMoney(el.value, cur.decimals));
        }}
      />
    </span>
  );
}
