# RedditPulse Web

This app is the local-admin frontend for RedditPulse. It covers:

- first-run setup for Gemini and workflow settings
- subreddit management
- manual n8n run triggering
- a run-based archive of saved subreddit digests

## Current Status

- the frontend scaffold is implemented
- the app passes `lint` and `build`
- `.env.local` has already been created locally for the current machine
- if Supabase env values are unavailable, the app falls back to demo data so the interface still renders

## Environment

Copy `.env.example` to `.env.local` and provide:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

If those values are missing, the app falls back to a demo dataset so the UI can still render.

## Commands

```bash
npm run dev
npm run lint
npm run build
```

## Handoff Note

The next thread should use Supabase MCP to inspect or update the live project, then verify that the frontend setup screen, subreddit management, and manual run flow are pointing at the correct live services.
