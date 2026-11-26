# Kwenta

A budget tracker where you log money by typing (or speaking) a sentence like `grab 250 gcash`,
or by chatting with **Alki**, Kwenta's little bamboo coin-bank helper.

## Features

- **Home**: greeting, Alki's insight of the day, quick log by text or voice, quick actions,
  monthly spending donut, today/week/month totals, a countdown to your next sweldo with a daily allowance,
  upcoming bills, budgets and recent entries.
- **Wallet**: net worth (assets minus card debt), colored account cards grouped into cash,
  e-wallets, banks and credit cards, credit limits, and a daily net-worth chart.
- **Plan**: custom budgets (any category, daily / weekly / every 2 weeks / monthly / yearly),
  your own categories with emoji, color and keywords, savings goals, and recurring bills or income that you
  can mark as paid in one tap.
- **History**: 🔍 search, 📅 dates (this week / this month / last month / custom) and ⚙ filter (type,
  account, categories) live behind header buttons; active filters show as removable chips with a
  spent / received total. Daily totals leave out Debt moves. Tap any entry (here or in Home →
  Recent) to edit its amount, note, category, account, date or type, or delete it (with undo).
- **Get started**: first-run setup for new users (name, sweldo schedule, first account, optional PIN).
- **Stats**: spent, income, net flow, category breakdown, last 7 days, 30/90-day net-worth trend,
  cashflow forecast to payday, and a printable income statement.
- **Chat with Alki**: log entries ("spent 220 on Starbucks from my GCash account",
  "paid 3,421 for my electric bill last Friday") or ask questions ("what's my balance?",
  "how much did I spend this week on food?", "can I afford 2000?"). Runs fully offline.
- **Bank & app picker**: 70+ Philippine e-wallets, digital banks, banks, credit cards and
  pay-later apps with their logos, split into Debit and Credit. Missing logos fall back to a
  brand-color monogram, and you can upload your own logo for any account.
- **Credit card installments**: track purchases, cash loans and balance conversions with each
  bank's published add-on rates and fees (BDO, BPI, Metrobank, RCBC, plus 0% and custom), a live
  calculator showing the monthly payment, total interest and true effective rate, a BSP-cap warning,
  due dates on Home, and monthly totals on each card. Rates live in `lib/installments.ts`.
- **Multiple currencies**: each account has its own currency (25 supported, incl. USD, SAR, AED,
  JPY, HKD, SGD, KRW). Net worth, stats, budgets and goals are converted to your main currency.
  Transfers between currencies record the amount received. Rates are built in, editable, and can be
  updated online from ExchangeRate-API (public rates only). Code: `lib/currency.ts`.
- **Sweldo schedule**: monthly, twice a month (kinsenas), weekly or every 2 weeks; drives the
  "Next sweldo" countdown, daily allowance and forecast.
- **Monthly recap**: a tap-through story of last month (money in/out, top categories, biggest
  expense, busiest day, no-spend days, most-used account, money style). Offered on Home during the
  first 10 days of a month, or play any month from Stats. Code: `lib/recap.ts`.
- **Alki's moods**: happy, excited, calm, sleepy, worried, sad or upset, based on budgets, bills,
  sweldo, goals and logging habits (`lib/mood.ts`). Tap Alki for a reaction that acts out the mood.
- **Works on phones and tablets**: phone layout from 320px up; on tablets the header spans the
  screen, Home splits into two columns (from 900px), and Wallet shows accounts side by side.
- **Reminders**: a "Due soon" banner on Home (overdue or due within 2 days, with Paid/Posted
  buttons; credit cards warn 1 to 7 days ahead, your choice, and show the minimum due) and optional
  daily notifications (Settings → Reminders). Credit cards also get a "statement ready" reminder on
  the cut-off day, where you confirm the bank's figure in one tap, and any item can be snoozed.
  Background notifications use Periodic Background Sync (no server; Chrome decides the time, about
  once a day, installed app only). The service worker reads a small list of titles and dates (never
  amounts) from Cache Storage; titles can be hidden. For iPhone and other browsers, see
  [Push reminders](#push-reminders). Code: `lib/reminders.ts`, `public/sw.js`,
  `components/StatementFix.tsx`, `lib/push.ts`.
- **Debts & split bills** (Plan → Debts): "you owe" / "owed to you" with partial payments, due
  dates (shown in Due soon and reminders), and bill splitting (equal or custom) with a shareable
  summary. Lending, borrowing and paying back are logged under 🤝 Debt, which changes balances but
  isn't counted as income or spending. Edit a debt to change its account, amount or direction (the
  logged entry follows), and each payment's account, or remove a payment. Code: `lib/debts.ts`, `components/Debts.tsx`.
- **Archive / hide accounts**: hide an account from net worth, or archive it out of lists and pickers.
- **Receipt photos**: attach a photo to any entry. Photos are shrunk, encrypted (AES-GCM, own key
  protected by the PIN lock) and stored in IndexedDB on the device; included in full JSON backups.
  Code: `lib/photos.ts`.
- **Scan receipts** (📷 in the entry screen or Home → Scan): reads the photo on the phone with
  Tesseract.js and pre-fills total, store, date and category for review; the photo is attached.
  Engine files are self-hosted in `public/ocr` (~7 MB first scan, then cached offline); refresh them
  with `npm run ocr:assets` after updating tesseract.js. Parsing rules: `lib/receipt.ts`.
- **Locked savings / time deposits** (Wallet → 🔒 Locked savings): amount, rate (per year “p.a.” or per
  month: tap p.a. or /mo; stored yearly, shown the way you entered it; a warning, not a block,
  for unusually high monthly rates), term and
  start date; shows the maturity date, countdown, interest after 20% withholding tax and the amount
  at maturity. Maturity shows in Due soon and reminders; Collect moves the money back and logs the
  interest as income (Withdraw early handles penalties). Locked money counts in net worth but not in
  the daily allowance or pickers. Code: `lib/deposits.ts`, `components/Locked.tsx`.
- **Shared credit limits** (Wallet → card → Credit limit → "Shared with …"): cards from the same
  bank or supplementary cards draw from one limit; available credit counts what every card in the
  group used, and shows "over limit" when exceeded. Code: `limitHolder` / `creditInfo` in `lib/cards.ts`.
- **Credit card due dates** (Wallet → card → Statement day / Payment due day). The amount owed at
  start is billed on the first cut-off after it was entered (`openingAt`), and "Statement balance
  (from your bank)" overrides the estimate for the current statement (`stmtFix`). Statement balance
  (unbilled installment principal excluded), minimum due estimate (3%, at least ₱500, editable),
  "Due tomorrow" / "Overdue 3 days ⚠️" labels, Due soon + reminders, Alki worried (≤2 days) or sad
  (overdue). Pay card transfers the full, minimum or a custom amount; "mark as paid" for payments
  made outside Kwenta. Code: `lib/cards.ts`, `components/PayCard.tsx`.
- **Keypad entry** with recent entries for one-tap repeats.
- **Streaks and badges** that unlock accessories for Alki: a mix-and-match closet with head,
  eyes, neck and hand items (salakot, Pasko hat, round glasses, sampaguita lei, mini flag, kape…).
  Open it from Settings → Alki → Dress up Alki, or from the streak screen. Items: `lib/closet.ts`.
- **8 color themes** (Forest green default, Mint, Sage, Ocean, Lavender, Rose, Bamboo, Graphite), each with light/dark mode, **JSON backup/restore** and **CSV import/export**.
Built with **Next.js (App Router), React, TypeScript, Node.js** and an optional **Python (FastAPI)** parser service.

## Tech stack & tools

**App**

| Area | What is used |
| --- | --- |
| Framework | [Next.js](https://nextjs.org) 16 (App Router), [React](https://react.dev) 18 |
| Language | TypeScript 5 (strict mode) |
| Styling | Plain CSS with custom properties (`app/globals.css`): 8 palettes, light/dark mode, no CSS framework |
| App type | Installable PWA: web manifest (`app/manifest.ts`) and a hand-written service worker (`public/sw.js`) for offline use, reminders and push |
| State and storage | React hooks with `localStorage` (`lib/store.ts`); IndexedDB for receipt photos (`lib/photos.ts`) |
| Icons and art | [Lucide](https://lucide.dev) icons (ISC), [Circle Flags](https://github.com/HatScripts/circle-flags) (MIT), bank and card logos fetched or built by scripts in `scripts/`. See `THIRD_PARTY_LICENSES.md` |

**Libraries**

| Library | Used for |
| --- | --- |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript) and `@supabase/ssr` | Optional sign-in and encrypted cloud backup |
| [`tesseract.js`](https://github.com/naptha/tesseract.js) | Reading receipt photos on the phone (OCR); engine files are self-hosted in `public/ocr` |
| [`jsqr`](https://github.com/cozmo/jsQR) | Reading payment QR codes from images |
| `qrcode` (dev only) | Generating QR codes in tests |

**Browser features** (no extra libraries)

- Web Crypto: AES-256-GCM and PBKDF2 for the PIN lock, protected backups and cloud sync (`lib/crypto.ts`)
- WebAuthn with the PRF extension: optional fingerprint unlock (`lib/biometric.ts`)
- Service Worker, Cache Storage and Periodic Background Sync: offline use and daily reminders
- Push API and Notifications: optional push reminders (`lib/push.ts`)
- Web Speech API: voice input for quick logging

**Services**

| Service | Role |
| --- | --- |
| [Vercel](https://vercel.com) | Hosts the app and serves the security headers set in `next.config.mjs` |
| [Supabase](https://supabase.com) | Auth, Postgres with row-level security (feedback, testimonials, push devices), Edge Functions and `pg_cron` / `pg_net` for scheduled push reminders |
| [ExchangeRate-API](https://www.exchangerate-api.com) (`open.er-api.com`) | Optional public exchange rates; only the request is sent, no personal data |

**Optional backend pieces**

- Python parser service: [FastAPI](https://fastapi.tiangolo.com), Uvicorn and Pydantic (`python/`)
- Push sender: a Supabase Edge Function on Deno using the [`web-push`](https://github.com/web-push-libs/web-push) library (`supabase/functions/send-reminders`)

**Dev tools**

| Tool | Used for |
| --- | --- |
| npm | Dependencies and scripts (`dev`, `build`, `typecheck`, `test`, `logos`, `cards`, `icons`, `ocr:assets`) |
| `tsc` | Type checking (`npm run typecheck`) |
| [`tsx`](https://tsx.is) with Node's built-in test runner | TypeScript tests (`npm test`) |
| pytest and httpx | Python parser tests |
| Supabase CLI | Deploying the push sender function and secrets |

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

## Optional: Python parser service

```bash
cd python
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Then create `.env.local` (see `.env.example`):

```
NEXT_PUBLIC_USE_SERVER_PARSER=true
PARSER_URL=http://127.0.0.1:8000
```

The browser calls `POST /api/parse` (a Node route). That route forwards to the Python service,
and falls back to the built-in TypeScript parser if Python is not reachable.
With `NEXT_PUBLIC_USE_SERVER_PARSER=false` (the default) parsing happens entirely in the browser.

## Bank logos

Logos live in `public/logos/` and are listed in `lib/logos.generated.ts`. To refresh them or
pick up logos for newly added institutions (edit `lib/institutions.ts`):

```bash
npm run logos            # downloads only missing logos
npm run logos -- --force # re-downloads all
```

Sources, best first: Google's site-icon service, then icons the bank's homepage declares, then
`/apple-touch-icon.png` / `/favicon.ico`. Icons under 48px are skipped (a brand-color monogram is
shown instead). Files can be PNG, ICO or SVG.

You can also drop your own `<id>.png` into `public/logos/` and re-run `npm run logos` to
register it. Logos are the trademarks of their owners and are used only to identify accounts.

## Push reminders

Optional. Background reminders on their own only work in Chrome/Edge with the app installed (Android, some
desktops). To also reach **iPhone** (iOS 16.4+, app added to the Home Screen) and any browser with web push,
Kwenta can use push through your own Supabase project.

**What the server learns:** which devices want reminders and *when* to wake them. The push it sends is empty;
the phone builds the text from its own saved list. Titles, amounts and dates of bills never leave the device.

Setup (once):

1. **Keys.** `npx web-push generate-vapid-keys` prints a public and a private key.
2. **Database.** Supabase → SQL Editor → run `scripts/push.sql` (everything above its commented-out schedule section).
3. **Sender.** With the Supabase CLI, in this folder:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<a long random string>
   supabase functions deploy send-reminders --no-verify-jwt
   ```
4. **Schedule.** In the SQL Editor, run the commented-out `cron.schedule(...)` block at the bottom of
   `scripts/push.sql` after replacing your project ref and the same `CRON_SECRET`. Wake-ups are sent at 9:00
   (your phone's local time) on days that have something due, checked every 15 minutes.
5. **App.** Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>` to Vercel's environment variables (and `.env.local`),
   then redeploy. It is read at build time.
6. **Each device.** Sign in under Settings → Account, then Settings → Reminders → *Turn on push reminders*.
   On iPhone, first Share → Add to Home Screen and open Kwenta from there.

Without step 5 the option stays hidden and nothing else changes. Code: `lib/push.ts`, `lib/reminders.ts`
(`wakeTimes`), the `push` handler in `public/sw.js`, `supabase/functions/send-reminders`.

## Security & privacy

- **Data stays on the device.** No server stores money data; Vercel only serves the app files. (Optional cloud backup is encrypted in the browser. Optional push reminders store only device addresses and wake-up times.)
- **PIN lock (optional, Settings → Security).** When on, all data is encrypted at rest with
  AES-256-GCM using a key derived from the PIN (PBKDF2-SHA256, 310,000 rounds). The PIN is never
  stored. The app re-locks after a chosen time in the background, blurs content in the app
  switcher, and slows down repeated wrong guesses. A forgotten PIN cannot be recovered.
- **Protected backups.** JSON backups can be encrypted with a password. CSV exports are plain text.
- **Local device transfer.** In Settings → Your data → Move data to another device, create a
  password-protected JSON file, move it locally, then import it on the new device. Kwenta does not
  upload the file; PIN locks are set separately on each device.
- **Safe imports.** Importing asks for confirmation and keeps a (encrypted, if PIN is on) safety
  copy you can restore with "Undo last import".
- **Voice input** uses the browser's speech service (Google in Chrome); the app asks once before
  using the mic. Typing never leaves the device.
- **Cloud backup access rules.** Run `scripts/snapshots.sql` once in Supabase. The app filters by user id in
  the browser, which is not protection by itself; these row-level rules are what stop one account from
  downloading another's (encrypted) backup. The script ends with queries to check every table.
- **Push safety.** Push addresses are only accepted from real browser push services (Google, Apple, Mozilla,
  Microsoft), checked in the database and again in the sender, so a device record can't make the server call
  arbitrary addresses. The sender compares its secret in constant time and never returns internal errors.
- **Security headers** (CSP, frame blocking, nosniff, referrer and permissions policies) are set
  in `next.config.mjs`.
- Code: `lib/crypto.ts`, `lib/store.ts`, `components/LockScreen.tsx`.

## Limits and abuse protection

Kwenta talks to Supabase straight from the browser, so the limits that matter must live in Supabase, not in the app.

**In the app (`lib/upload.ts`, `lib/ratelimit.ts`)**
- Every picture (receipt, QR, logo, feedback screenshot) is checked by its real first bytes: only JPEG, PNG, WebP, GIF or HEIC.
  SVG, PDFs, programs and renamed files are refused. Max 15 MB and 50 megapixels (stops "image bombs"), checked before decoding.
- Only a JPEG of 2 MB or less can be uploaded to the cloud.
- `/api/parse` accepts at most 16 KB per request and 40 requests a minute per address (best effort, see below).

**In Supabase: run `scripts/limits.sql` once** (after the other scripts)
- Cloud backup: 5 MB max, and no more than one write per 2 seconds.
- Feedback screenshots: private bucket, JPEG only, 2 MB each, strict file name, 10 a day and 50 in total per account.
- Feedback text: 10 a day per account.

**Captcha for sign-up and sign-in (Cloudflare Turnstile, free).** Do these IN THIS ORDER, or sign-in breaks:
1. Cloudflare dashboard → Turnstile → Add widget (add your site's domain, plus `localhost` for testing). Copy the **site key** and the **secret key**.
2. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`.env.local` and Vercel) and **deploy**. The app then shows the check, and works with or without Supabase's captcha on.
3. Only then: Supabase → Authentication → Attack Protection → Enable captcha → provider **Turnstile by Cloudflare** → paste the **secret key** → Save.
(Turn the Supabase switch on BEFORE the app has the key, and every sign-in fails with "captcha verification process failed".)

**In the dashboards (cannot be set from code, please do these)**
- Supabase → Authentication → Rate Limits: lower sign-ups, sign-ins and emails per hour; turn on CAPTCHA (Authentication → Attack Protection) so bots can't mass-create accounts.
- Supabase → Settings → Billing: keep the Spend Cap on, so a flood can't turn into a bill. Storage → Settings: global upload size limit.
- Vercel → Firewall → Rate limiting: add a rule for `/api/*` (the in-app limiter is per server copy, this one is global).

## Plans (monthly, annual, lifetime)

- **7-day free trial:** every new account gets full access for 7 days from sign-up (once per account, counted from the account's creation date in the database, so it can't be restarted). Existing accounts older than 7 days don't get one (people with a cloud backup get the 30-day grace instead). To change the length, edit `interval '7 days'` in `scripts/plans.sql` (two places) and the Terms.
- **Free plan:** up to 2 accounts; logging, receipts, budgets, goals, cash flow, reminders, file backups, and restoring or deleting an existing cloud backup.
- **Paid (monthly, annual, lifetime):** unlimited accounts, Installments, Debts, Statistics, and cloud backup/auto-sync. Admin accounts (the `admins` table) are exempt and always have everything.
- Change what is paid in `lib/plans.ts` (`FREE_ACCOUNT_LIMIT`, `PAID_PLAN_TABS`, `STATS_PAID`).
- Only **cloud saving** is enforced by the database. Accounts, Installments, Debts and Statistics live on the device, so those limits are enforced in the app (a determined person could bypass them; they can't cost you any cloud space). People who already have more than 2 accounts keep them and just can't add more.
- Run `scripts/plans.sql` once in Supabase. The rule is enforced there (row-level security on `snapshots`), so it can't be bypassed from the browser. Existing cloud users get 30 days of access so sync doesn't stop overnight.
- Prices and plan names are in `lib/plans.ts`. The screen is `components/Plans.tsx` (Settings → Cloud backup → See plans).
- **Payments are manual for now** (no online provider is set up; Stripe isn't available in the Philippines and PayMongo isn't open for sign-up). People pick a plan, see your GCash number and instructions, pay, and send proof. Then you open `/admin` → "Plans: activate after payment", type their account email, choose the plan and press Activate. Monthly/annual add time on top of what they have; lifetime never ends.
  Add your QR Ph picture as `public/pay-qr.png` and set `NEXT_PUBLIC_PAY_QR=/pay-qr.png` (a QR or a GCash number is enough; both can show). Set the number shown to people with `NEXT_PUBLIC_PAY_GCASH_NUMBER`, `NEXT_PUBLIC_PAY_GCASH_NAME` and `NEXT_PUBLIC_PAY_CONTACT` (see `.env.example`; set them in Vercel too and redeploy, since they are baked in at build time). Until they're set, the app says "Payments aren't open yet".
- Later, an automatic provider can write into `public.subscriptions` with the service role; the app and database rules don't need to change.

## Legal and payment safety (read before charging anyone)

This is a technical checklist, **not legal advice**. Have a Philippine lawyer or accountant review it; the Terms and Privacy pages are drafts written for what the app does.

**Already in the app**
- `/terms` and `/privacy` pages, linked from sign-up (with a required "18+ and I agree" checkbox), Settings and the Plans screen. Set `NEXT_PUBLIC_LEGAL_NAME` and `NEXT_PUBLIC_LEGAL_EMAIL` first (they show as the contact), and redeploy.
- Plans never renew automatically, prices are shown up front, and a 7-day refund rule is written in the Terms (edit it in `app/terms/page.tsx` if you want a different rule).
- Payments are made directly by the person to your account; Kwenta never touches card or wallet details, so there is no card data to protect in the app.
- Plans can't be self-granted: the table has no write access from the app. Only admins can grant or remove a plan, they must confirm each time, and every grant/removal is recorded in `plan_log` (who, whom, when, which plan). Read it in the SQL Editor: `select * from plan_log order by at desc;`
- Cloud features are enforced in the database (see "Plans" and "Limits").

**Things only you can do (please check the current rules for each)**
- **Register the business** (DTI for a sole proprietor, or SEC), get BIR registration and issue official receipts/invoices for payments, and keep your payment records. Income from sales is taxable.
- **Data Privacy Act:** appoint someone responsible for privacy (a Data Protection Officer, even if it's you), keep a short record of what you process, and check with the National Privacy Commission whether you must register. You must report serious data breaches to the NPC and affected people (currently within 72 hours).
- **Supabase and Vercel** store data outside the Philippines; the Privacy Notice says so. Keep it accurate if you change providers.
- **Payment hygiene:** only take payments to an account in your (business) name; check that the money actually arrived before you press Activate; never share your admin login; turn on two-factor sign-in for GCash/bank, Supabase and Vercel; keep `.env.local` out of any public repository.
- **Never put secrets in `NEXT_PUBLIC_` variables** (they are shown to everyone). The GCash number, QR and legal email are meant to be public.

## One account per person

- Supabase refuses the exact same email. Run `scripts/signup-guard.sql` once to also refuse other spellings of it (`+tags`, dots in Gmail, capitals, googlemail.com), so one person can't collect many free trials. It only affects new sign-ups; the script ends with a query that lists existing look-alike accounts.
- Wallet account names must be unique per person (case and spacing ignored), checked in `lib/names.ts`.
- Display names (Settings → Profile) are personal labels stored on the device, so they are not unique. Making them unique would need public usernames.

## Tests

```bash
npm test                      # TypeScript parser
npm run typecheck
cd python && python -m pytest # Python parser + API
```

## How it fits together

| Piece | Where |
| --- | --- |
| UI (React, TypeScript) | `app/`, `components/` |
| App state + localStorage (migrates old `kwenta-v1` data) | `lib/store.ts` |
| Balances, forecasts, streaks | `lib/stats.ts` |
| Alki's chat replies and insights | `lib/assistant.ts`, `lib/insights.ts` |
| Badges and outfits | `lib/badges.ts` |
| Backup, CSV import/export | `lib/backup.ts` |
| Sentence parser (TypeScript) | `lib/parser.ts` |
| API route (Node.js) | `app/api/parse/route.ts` |
| Sentence parser (Python) | `python/entry_parser.py`, `python/main.py` |

Data is saved in the browser's localStorage. Accounts and a database (Supabase) are optional and only used for sign-in, the encrypted cloud backup and push reminders.

Note: the Python parser does not yet understand "last Friday" / "3 days ago" or drop filler
words like "spent ... on"; the TypeScript parser does. Chat with Alki always uses the TypeScript parser.

## Ideas to extend

- Live device-to-device sync over a local network (no cloud; both devices would need to be online).
