import type { RunRecord } from "@/lib/types";

function normalizePreviewImageUrl(value: string) {
  return value
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");
}

function buildPreviewImageSrc(value: string) {
  const normalized = normalizePreviewImageUrl(value);
  return `/api/preview-image?url=${encodeURIComponent(normalized)}`;
}

function splitSummaryParagraphs(summary: string) {
  return summary
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function LatestBriefing({ run }: { run: RunRecord | null }) {
  const digests = run?.digests ?? [];
  const hasSingleDigest = digests.length === 1;

  return (
    <section className="glass-panel rounded-[1.25rem]">
      <div className="space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="section-title">Latest Briefing</p>
            <h2 className="text-2xl font-semibold tracking-[-0.05em]">
              Current briefing output
            </h2>
          </div>
        </div>

        {!run ? (
          <article className="rounded-[1rem] border border-dashed border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
              No run yet
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-soft">
              Trigger a manual run to populate the briefing cards here.
            </p>
          </article>
        ) : (
          <div
            className={
              hasSingleDigest
                ? "space-y-4"
                : "space-y-4 md:columns-2 md:gap-4 md:space-y-0"
            }
          >
            {digests.map((digest) => (
              <section
                key={digest.id}
                className={`rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-4 md:p-5 ${
                  hasSingleDigest
                    ? ""
                    : "md:mb-4 md:inline-block md:w-full md:break-inside-avoid"
                }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
                      r/{digest.subredditName}
                    </p>
                    <h3 className="text-lg font-semibold tracking-[-0.04em]">
                      {digest.headline}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <span className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
                      {digest.sourceCount} sources
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-4 text-sm leading-6 text-[var(--foreground)]">
                  {splitSummaryParagraphs(digest.summary).map((paragraph, index) => (
                    <p key={`${digest.id}-paragraph-${index}`}>{paragraph}</p>
                  ))}
                </div>

                <div className="mt-4 border-t border-black/10 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
                    Sources
                  </p>
                  <div className="mt-2 space-y-2">
                    {digest.sources.length === 0 ? (
                      <p className="py-1 text-sm text-soft">
                        Source links will appear once the workflow writes the
                        finished digest to Supabase.
                      </p>
                    ) : (
                      digest.sources.map((source) => (
                        <a
                          key={source.id}
                          href={source.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="operator-hover flex items-start gap-3 rounded-[0.75rem] px-2 py-2 transition-colors hover:bg-black/5"
                        >
                          {source.previewImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={buildPreviewImageSrc(source.previewImageUrl)}
                              alt={`Preview image for ${source.title}`}
                              loading="lazy"
                              className="mt-0.5 h-12 w-12 shrink-0 rounded-md border border-[color:var(--line)] object-cover"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-5">
                              {source.title}
                            </p>
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-soft">
                              u/{source.author} | {source.score} score |{" "}
                              {source.commentCount} comments
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-2">
                            {source.isImagePost ? (
                              <span className="rounded-md border border-[color:var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                                Image
                              </span>
                            ) : null}
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
