# RedditPulse

RedditPulse is a personal Reddit digest tool built as a monorepo. The MVP combines:

- a `Next.js + TypeScript` admin app in [`apps/web`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\apps\web)
- Supabase schema and seed files in [`supabase`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\supabase)
- an n8n workflow blueprint in [`n8n/workflows`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\n8n\workflows)

## Workspace Layout

- `apps/web`: setup screen, subreddit management, manual run trigger, and run archive UI
- `supabase/migrations`: MVP database schema
- `supabase/seed.sql`: starter config and sample data
- `n8n/workflows/redditpulse-manual-run.json`: n8n workflow export blueprint
- `n8n/README.md`: workflow setup notes and prompt contract

## Current Status

The repo is no longer day-zero. Current handoff state:

- the frontend MVP scaffold is implemented and builds successfully
- Supabase schema and seed files are present in-repo
- `apps/web/.env.local` has been populated locally with the current Supabase URL, the provided Supabase key, and the Gemini API key
- Codex MCP config was updated locally to point the Supabase MCP entry at project `keznlbbvitqrcndkmaoc`
- `n8n` was installed globally and verified locally at version `2.17.4`

## Handoff Notes

- The app is ready for local UI testing right now.
- Full end-to-end behavior still depends on live Supabase data plus an imported and configured n8n workflow.
- In the previous thread, the generic Supabase MCP discovery calls did not work from that session even though the new thread was able to use Supabase MCP. Continue MCP-based Supabase work from the fresh thread.
- The provided Supabase key was used exactly as given. If write operations fail, verify whether that key is truly a service-role key or only a publishable key.

## Quick Start

1. Install dependencies from the repo root with `npm install`.
2. Copy [`apps/web/.env.example`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\apps\web\.env.example) to `.env.local` inside `apps/web`.
3. Run the SQL in [`supabase/migrations/001_redditpulse_mvp.sql`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\supabase\migrations\001_redditpulse_mvp.sql).
4. Optionally load [`supabase/seed.sql`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\supabase\seed.sql) for a starter dataset.
5. Import [`n8n/workflows/redditpulse-manual-run.json`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\n8n\workflows\redditpulse-manual-run.json) into n8n and connect your credentials.
6. Start the app with `npm run dev`.

## MVP Behavior

- The app is a no-auth local-admin dashboard.
- Manual runs are triggered directly from the browser to an n8n webhook.
- n8n fetches `hot` posts from public Reddit JSON endpoints.
- Each enabled subreddit produces one digest card per run.
- Digests are stored in Supabase and rendered as a run archive.

## Immediate Next Steps

1. Use the fresh Codex thread for Supabase MCP work.
2. Apply the SQL in [`supabase/migrations/001_redditpulse_mvp.sql`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\supabase\migrations\001_redditpulse_mvp.sql) to the live Supabase project if not already applied.
3. Start local n8n and import [`n8n/workflows/redditpulse-manual-run.json`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\n8n\workflows\redditpulse-manual-run.json).
4. Connect the workflow to Supabase and Gemini credentials, then run the first end-to-end manual test from the frontend.
