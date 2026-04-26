insert into public.app_config (
  singleton,
  gemini_api_key,
  n8n_webhook_url,
  default_fetch_limit,
  default_digest_size,
  summarization_model
)
values (
  true,
  'AIza-demo-key-redacted',
  'https://n8n.local/webhook/redditpulse-manual',
  10,
  4,
  'gemma-4-31b-it'
)
on conflict (singleton) do update
set gemini_api_key = excluded.gemini_api_key,
    n8n_webhook_url = excluded.n8n_webhook_url,
    default_fetch_limit = excluded.default_fetch_limit,
    default_digest_size = excluded.default_digest_size,
    summarization_model = excluded.summarization_model;

insert into public.subreddit_configs (id, name, enabled, process_images)
values
  ('11111111-1111-1111-1111-111111111111', 'rantandventph', true, true),
  ('22222222-2222-2222-2222-222222222222', 'offmychest', true, false),
  ('33333333-3333-3333-3333-333333333333', 'mildlyinfuriating', false, true)
on conflict (name) do update
set enabled = excluded.enabled,
    process_images = excluded.process_images;

insert into public.runs (
  id,
  status,
  source_listing,
  triggered_at,
  completed_at,
  total_subreddits,
  notes
)
values (
  '44444444-4444-4444-4444-444444444444',
  'succeeded',
  'hot',
  '2026-04-22T08:35:00Z',
  '2026-04-22T08:39:00Z',
  2,
  'Engagement-first curation kept each subreddit to one digest with four cited sources.'
)
on conflict (id) do nothing;

insert into public.run_digests (
  id,
  run_id,
  subreddit_config_id,
  subreddit_name,
  headline,
  summary,
  image_context_used,
  source_count
)
values
  (
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'rantandventph',
    'Relationship screenshot posts pushed confrontation and family stress to the top.',
    'The latest digest from r/rantandventph clustered around private-message screenshots, controlling partners, and home pressure spilling into public vent posts. Gemini used image context on the strongest screenshot-heavy threads, but the final card still stayed text-first and grounded the summary in four linked posts.',
    true,
    4
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'offmychest',
    'Workplace resentment and late-boundary breaking dominated the latest confession cycle.',
    'r/offmychest skewed toward work exhaustion, friends crossing boundaries, and people burning out while trying to look composed in public. The digest stayed text-only because the selected threads already carried enough body text to support a coherent paragraph without spending image budget.',
    false,
    4
  )
on conflict (id) do nothing;

insert into public.digest_sources (
  id,
  digest_id,
  title,
  author,
  permalink,
  score,
  comment_count,
  preview_image_url,
  is_image_post,
  sort_rank
)
values
  ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'Hindi ko na alam kung valid pa ba ''tong galit ko', 'taglishthrowaway', 'https://reddit.com/r/rantandventph/comments/demo1', 512, 63, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3', true, 1),
  ('88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', 'Parents keep comparing me to my siblings', 'manilamidnight', 'https://reddit.com/r/rantandventph/comments/demo2', 401, 41, null, false, 2),
  ('99999999-9999-9999-9999-999999999999', '55555555-5555-5555-5555-555555555555', 'Screenshots of a breakup that should have stayed private', 'burnerforventing', 'https://reddit.com/r/rantandventph/comments/demo3', 356, 27, 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4', true, 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Working all week tapos ako pa rin ang masama', 'quietcommute', 'https://reddit.com/r/rantandventph/comments/demo4', 274, 18, null, false, 4),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'I am tired of always being the calm one', 'stillholdingit', 'https://reddit.com/r/offmychest/comments/demo5', 890, 144, null, false, 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'My friend keeps sharing my secrets as jokes', 'cornersofsleep', 'https://reddit.com/r/offmychest/comments/demo6', 645, 88, null, false, 2),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '66666666-6666-6666-6666-666666666666', 'I can''t tell whether I''m angry or just exhausted', 'nightdeskworker', 'https://reddit.com/r/offmychest/comments/demo7', 514, 71, null, false, 3),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-6666-6666-6666-666666666666', 'My boss congratulated me after making me work through the weekend', 'latetrainhome', 'https://reddit.com/r/offmychest/comments/demo8', 472, 53, null, false, 4)
on conflict (id) do nothing;
