# Vehicle Damage Report Generator

A multi-user web app that turns a handful of vehicle photos into a structured,
AI-assisted preliminary damage report (PDF + on-screen summary): vehicle info,
per-photo damage observations, overall severity, affected components, and a
hidden/structural-damage flag. **It never produces dollar repair estimates** —
that's left to a certified appraiser.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind**
- **Auth:** Clerk (`@clerk/nextjs`)
- **Database:** Postgres (Supabase, Neon, or any Postgres) via **Prisma 7** (using the `@prisma/adapter-pg` driver adapter)
- **Storage:** AWS S3 for uploaded photos and generated PDFs
- **AI:** Anthropic Claude (`claude-opus-5`, vision) for structured damage analysis
- **PDF:** server-rendered HTML → PDF via Puppeteer

## Security model

- All Clerk/AWS/Anthropic credentials are read only in server-only modules
  (`src/lib/*.ts`, all tagged with `import "server-only"`) and API routes —
  never sent to the client.
- Every database query that touches `reports` or `report_images` is scoped by
  the signed-in user's id at the query level (see `src/lib/reports.ts`). The
  UI never decides which rows a user can see; a request for another user's
  report id simply returns nothing.
- Claude is explicitly instructed (system prompt + schema with no cost field)
  to never produce dollar repair estimates — only severity/category flags.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

- **`DATABASE_URL`** — a Postgres connection string (e.g. from
  [Supabase](https://supabase.com) or [Neon](https://neon.tech)).
- **Clerk keys** — create an application at https://dashboard.clerk.com and
  copy the publishable/secret keys. Also create a webhook endpoint pointing
  at `/api/webhooks/clerk` (events: `user.created`, `user.updated`,
  `user.deleted`) and copy its signing secret into
  `CLERK_WEBHOOK_SIGNING_SECRET` — this keeps the local `User` table in sync
  with Clerk. (The app also lazily upserts the user on first request, so
  the webhook isn't strictly required to use the app locally.)
- **AWS** — create an S3 bucket (private, no public access) and an IAM user
  scoped to `s3:PutObject` / `s3:GetObject` on that bucket only.
- **`ANTHROPIC_API_KEY`** — from https://console.anthropic.com.

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

This applies `prisma/schema.prisma` (the `User` / `Report` / `ReportImage`
models) to your database and regenerates the Prisma Client.

### 4. Run the dev server

```bash
npm run dev
```

Visit http://localhost:3000, sign in, and create a report from
`/dashboard/new`.

## How a report is generated

1. `POST /api/reports` receives 2–6 photos + optional metadata (make, model,
   year, claim number, date of incident) as `multipart/form-data`.
2. Each photo is uploaded to S3 under `reports/<userId>/<reportId>/images/`.
3. The same photo bytes are sent to Claude (`claude-opus-5`, vision) via
   `client.messages.parse()` with a Zod schema (`src/lib/analyze.ts`), which
   guarantees a structured, schema-valid JSON response — vehicle info,
   per-photo observations, overall severity, affected components, and a
   hidden/structural-damage flag. No cost estimate field exists in the
   schema, and the system prompt explicitly forbids one.
4. That JSON is rendered into a one-page HTML report
   (`src/lib/pdf-template.ts`) with a visible AI-disclaimer, then converted
   to PDF with a headless browser (`src/lib/pdf.ts`) and uploaded to S3.
5. The `Report` row is updated to `COMPLETE` with the analysis JSON and the
   PDF's S3 key, and shows up on the user's dashboard.

### PDF generation in production

`src/lib/pdf.ts` auto-detects its environment:

- **Local dev / a normal Node server:** uses the full `puppeteer` package
  (bundles its own Chrome — simplest for local development).
- **Vercel / AWS Lambda** (detected via `VERCEL` / `AWS_LAMBDA_FUNCTION_VERSION`
  / `AWS_EXECUTION_ENV`): uses `puppeteer-core` + `@sparticuz/chromium`, a
  Chromium build sized for serverless deployment packages.

No configuration is needed to switch between them.

## Testing locally without real AWS credentials

`npm run dev:s3` starts a local S3-compatible server ([s3rver](https://github.com/jamhall/s3rver))
on `http://127.0.0.1:4569` with the dev bucket pre-created. Point the app at
it by adding to `.env.local`:

```bash
AWS_ACCESS_KEY_ID="S3RVER"
AWS_SECRET_ACCESS_KEY="S3RVER"
S3_BUCKET_NAME="vehicle-damage-reports-dev"
AWS_S3_ENDPOINT="http://127.0.0.1:4569"
```

`src/lib/s3.ts` only applies `AWS_S3_ENDPOINT` when it's set, so leaving it
unset (the normal case) talks to real AWS exactly as before. This has been
exercised end-to-end (upload → presigned URL → download round-trip, and the
full report pipeline writing images and the generated PDF).

Clerk and Anthropic still require real accounts — there's no local
substitute for either, since Clerk needs to issue real signed-in sessions and
Anthropic's vision analysis needs a real model call.

## Project structure

```
src/
  app/
    page.tsx                     # Landing page
    sign-in/, sign-up/           # Clerk auth pages
    dashboard/                   # List + search reports, new report form, report detail
    api/reports/                 # POST create report, GET presigned PDF download
    api/webhooks/clerk/          # Keeps `User` table in sync with Clerk
  lib/
    auth.ts                      # getOrCreateUser() / requireUserId()
    db.ts                        # Prisma client singleton
    reports.ts                   # All report/image queries — always filtered by userId
    s3.ts                        # Upload + presigned-URL helpers
    analyze.ts                   # Claude vision call + Zod schema (no cost fields)
    pdf.ts / pdf-template.ts     # HTML → PDF rendering
    env.ts                       # Validates all required server env vars at startup
prisma/schema.prisma             # User / Report / ReportImage models
```

## Build order this project followed

1. Clerk auth + empty dashboard (login/logout, per-user isolation)
2. S3 upload + a single Claude call returning structured JSON
3. PDF template + S3 save/download
4. Dashboard listing with claim-number search

## Disclaimer

Every generated report visibly states that it is an **AI-generated
preliminary summary, not a certified appraisal**, and includes no repair
cost estimate.
