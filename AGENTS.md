# AGENTS.md

## Project Identity

RedditPulse is a monorepo for a Reddit summarization product. The goal is to ingest selected subreddit posts, summarize the useful ones, persist normalized results, and present them in a clean UI.

This repository is intended to become the source of truth for:

- the web application
- n8n workflow assets and exports
- Supabase schema, SQL, and configuration
- product and engineering documentation

At the moment the repo is day-zero and only contains the initial idea doc. Future work should grow from that baseline instead of treating the current emptiness as accidental.

## Product Mission

RedditPulse summarizes selected subreddit posts, including optional image-aware summaries for screenshot-heavy communities where the important context may live inside the image.

The first product slice is intentionally small and should stay focused on proving the core loop:

1. A user manually triggers a run from the app.
2. n8n fetches posts from selected subreddits.
3. The workflow routes posts through text-only or image-assisted summarization.
4. Summaries are stored in Supabase.
5. The UI renders cards with the summary and source context.

Do not optimize for scheduled automation first. Manual end-to-end validation is the MVP.

## Default Technical Direction

Unless a later product decision explicitly replaces these defaults, assume:

- Frontend: Next.js with TypeScript
- Orchestration: n8n
- Persistence: Supabase
- Default summarization provider: Gemini Flash

Gemini Flash is the default low-cost multimodal model for both text-only and image-assisted summaries. Do not introduce a provider abstraction in the first implementation unless a concrete requirement appears.

## Repository Direction

Treat this repo as a monorepo even if the folders do not exist yet. Organize work so the codebase can clearly hold:

- a web app for manual triggering and result browsing
- workflow definitions or exports for n8n
- Supabase database setup, schema, and supporting SQL
- docs that explain contracts between the app, workflow, and database

Prefer decisions that keep these areas loosely coupled and easy to evolve independently.

## MVP Product Rules

- Build for single-user operation first.
- It is acceptable for the schema to remain extensible for future `user_subscriptions`, but do not require full multi-user auth in the MVP.
- Cards should support both text-only and image-assisted summaries.
- Summary records should include source/original link fields and may include optional media preview fields.
- Keep the first flow manually triggered from the UI rather than scheduler-first.

## Image Handling Rules

Image processing is a configurable capability, not a default requirement for every subreddit.

- Support a per-subreddit toggle for image summarization.
- Default image processing to disabled unless explicitly enabled.
- Use image-aware summarization only when the subreddit or workflow configuration opts in.
- Preserve enough source metadata so the UI can expose the original post or image when relevant.

This project should stay cost-aware. Avoid sending low-value image content to the model when a text-only path is sufficient.

## Workflow Contract

The intended workflow contract for the first implementation is:

- a manual app action starts an ingest run
- n8n fetches subreddit posts
- the router classifies posts into text, image, or discard paths
- Gemini Flash generates concise summaries for selected posts
- Supabase stores normalized summary records for the UI

Low-value posts may be discarded when they are unlikely to improve the feed.

## UI And Data Contract

The UI should be designed around stored summary records rather than raw Reddit payloads.

Expected record capabilities:

- concise summary text for rendering in cards
- source/original Reddit link
- optional media URL or preview URL for image-assisted posts
- enough context to distinguish text-only versus image-assisted summaries

Favor stable, normalized fields that make the frontend simple.

## Agent Working Rules

Multi-agent work is allowed in this project.

The user has explicitly authorized multi-agent use for this project whenever it helps move the work faster, as long as the delegated-agent model and reasoning limits below are respected.

Hard constraint:

- delegated agents must not use any model higher than `gpt-5.4-mini`
- delegated agents must not use reasoning/thinking above `medium`

When using multiple agents:

- split ownership by subsystem with disjoint responsibility where possible
- good boundaries include frontend, n8n workflow, and Supabase schema/docs
- keep shared contracts aligned through documentation in this repo
- do not create parallel agents with overlapping write ownership unless coordination is unavoidable

## Implementation Bias

Prefer the smallest end-to-end slice that proves the system works:

- manual trigger
- one working Reddit ingest path
- one working summarization path
- one persisted summary shape
- one UI card experience

Avoid early over-engineering around scheduling, provider abstraction, or consumer-scale multi-user features.

## Assumptions

- The current repository is intentionally minimal and currently contains only `idea.md`.
- Gemini Flash is the default model for affordable multimodal summarization.
- Supabase auth is not required for the first implementation unless the product direction changes.
- Scheduler-based automation can be added after the manual ingest-to-UI loop is working.
