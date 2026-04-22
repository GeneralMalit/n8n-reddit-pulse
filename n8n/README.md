# n8n Workflow Notes

The workflow blueprint in [`workflows/redditpulse-manual-run.json`](D:\Desktop\Main\Files\Programming\Projects\n8n Reddit Pulse\n8n\workflows\redditpulse-manual-run.json) is designed for the MVP contract:

- browser triggers n8n directly through a webhook
- n8n fetches `hot` listings from public Reddit JSON
- each enabled subreddit produces one digest card
- n8n writes runs, digests, and source links directly into Supabase

## Current Status

- `n8n` is already installed locally and verified at version `2.17.4`
- the workflow file exists, but it has not yet been imported into a live local n8n instance in this repo flow
- credentials and environment wiring still need to be completed inside n8n before the workflow can be executed end-to-end

Start local n8n with:

```bash
n8n start -o
```

## Expected Webhook Payload

```json
{
  "triggerMode": "manual",
  "sourceListing": "hot",
  "defaultFetchLimit": 10,
  "defaultSourceLimit": 4,
  "digestsLanguage": "en",
  "subreddits": [
    {
      "id": "uuid",
      "name": "rantandventph",
      "processImages": true
    }
  ]
}
```

## Recommended Credential Setup

- `Supabase REST` via HTTP Request nodes using `SUPABASE_URL` and service key headers
- `Gemini Flash` via HTTP Request to the multimodal generate-content endpoint

## Before First Live Test

- verify the Supabase key being used has write access for `runs`, `run_digests`, and `digest_sources`
- import the workflow JSON
- set the needed n8n environment variables or node credentials
- confirm the webhook URL matches the value saved in the frontend setup screen

## Prompt Contract

Use a single digest prompt per subreddit:

`Create one English-language digest for this subreddit run. Return a short headline, one summary paragraph, and the top 3-5 source posts that best support the digest. Keep the output grounded in the provided posts only.`

For image-enabled subreddits, send image bytes plus post title/body together when `post_hint` indicates image content.
