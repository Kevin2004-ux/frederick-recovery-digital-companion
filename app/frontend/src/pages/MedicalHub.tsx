import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, Loader2, Search, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { RecoveryGuideCard } from "@/components/library/RecoveryGuideCard";
import {
  RECOVERY_LIBRARY_CATEGORY_META,
  recoveryModuleTypeLabel,
} from "@/components/library/recoveryLibraryMeta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  RecoveryLibraryGuideSummary,
  RecoveryLibraryHomePayload,
} from "@/types";

type RecoveryHelperSection = {
  title: string;
  body?: string;
  items?: string[];
};

type RecoveryHelperResult = {
  id: string;
  title: string;
  moduleType: "education" | "task" | "milestone";
  summary: string;
  keyPoints: string[];
  sections: RecoveryHelperSection[];
  redFlags: string[];
  frequency?: string;
  requiredBoxItems: string[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

type RecoveryHelperSearchResponse = {
  query: string;
  blocked: boolean;
  message: string;
  results: RecoveryHelperResult[];
};

const SUGGESTED_TOPICS = [
  "wound care",
  "swelling",
  "pain medicine",
  "constipation",
  "nausea",
  "showering",
  "walking",
  "ice pack",
  "when to call your clinic",
];

function formatError(error: unknown) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "VALIDATION_ERROR") {
    return "Enter at least 2 characters to search for a recovery topic.";
  }

  return "We couldn’t load recovery guidance right now. Please try again.";
}

function SearchResultCard({ result }: { result: RecoveryHelperResult }) {
  return (
    <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-800">
            {recoveryModuleTypeLabel(result.moduleType)}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {result.title}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {result.summary}
            </p>
          </div>
        </div>

        {result.keyPoints.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Key points</div>
            <ul className="space-y-2">
              {result.keyPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                >
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.redFlags.length > 0 ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-sm font-semibold text-amber-950">
              When to contact your clinic
            </div>
            <ul className="mt-3 space-y-2">
              {result.redFlags.map((flag) => (
                <li
                  key={flag}
                  className="flex items-start gap-2 text-sm leading-6 text-amber-950/90"
                >
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500/90" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {result.frequency ? (
            <div className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700">
              {result.frequency}
            </div>
          ) : null}
          {result.requiredBoxItems.map((item) => (
            <div
              key={item}
              className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900"
            >
              {item}
            </div>
          ))}
        </div>

        <Link
          to={`/medical-hub/guides/${result.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-900"
        >
          Open the full guide
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}

function GuideSection(args: {
  title: string;
  description: string;
  guides: RecoveryLibraryGuideSummary[];
  emptyLabel: string;
}) {
  if (args.guides.length === 0) {
    return (
      <Card className="rounded-[30px] border border-dashed border-black/10 bg-white/80 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {args.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {args.emptyLabel}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {args.title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {args.description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {args.guides.map((guide) => (
          <RecoveryGuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </section>
  );
}

export default function MedicalHub() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [libraryHome, setLibraryHome] = useState<RecoveryLibraryHomePayload | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [results, setResults] = useState<RecoveryHelperSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLibraryHome() {
      setLibraryLoading(true);

      try {
        const payload = await api<RecoveryLibraryHomePayload>("/education/library", {
          method: "GET",
        });

        if (!active) return;
        setLibraryHome(payload);
      } catch {
        if (!active) return;
        setLibraryHome(null);
      } finally {
        if (active) setLibraryLoading(false);
      }
    }

    void loadLibraryHome();

    return () => {
      active = false;
    };
  }, []);

  async function runSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 2) {
      setHasSearched(true);
      setResults(null);
      setError("Enter at least 2 characters to search for a recovery topic.");
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const payload = await api<RecoveryHelperSearchResponse>(
        `/education/helper/search?q=${encodeURIComponent(trimmed)}`,
        { method: "GET" }
      );

      setResults(payload);
      setQuery(trimmed);
    } catch (err) {
      setResults(null);
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setHasSearched(false);
    setResults(null);
    setError(null);
  }

  const categoryCards = useMemo(() => libraryHome?.categories ?? [], [libraryHome]);
  const recommendedGuides = libraryHome?.recommendedGuides ?? [];
  const personalizedProcedureGuides = libraryHome?.personalized.procedureGuides ?? [];
  const personalizedBoxGuides = libraryHome?.personalized.boxItemGuides ?? [];
  const startHere = libraryHome?.sections["start-here"] ?? [];
  const commonTopics = libraryHome?.sections["common-recovery-topics"] ?? [];
  const videos = libraryHome?.sections.videos ?? [];
  const clinicInstructions = libraryHome?.sections["clinic-instructions"] ?? [];

  const isBlockedState = !loading && !error && !!results?.blocked;
  const isNoMatchState =
    !loading &&
    !error &&
    !results?.blocked &&
    hasSearched &&
    (results?.results.length ?? 0) === 0;
  const isSuccessState =
    !loading && !error && !results?.blocked && (results?.results.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="h-9 self-start rounded-full px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-900"
          onClick={() => navigate("/home")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card className="overflow-hidden rounded-[34px] border border-black/5 bg-white/95 shadow-[0_16px_42px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.96))] p-5 sm:p-7 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
                Digital Recovery Library
              </p>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Visual, simple recovery guidance for Frederick patients
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  Browse guides by category, open step-by-step instructions, and keep the current
                  recovery search when you want a quick answer.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {libraryHome?.personalized.procedureName ? (
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900">
                    Procedure: {libraryHome.personalized.procedureName}
                  </div>
                ) : null}
                {libraryHome?.personalized.boxItems.length ? (
                  <div className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1.5 text-sm text-stone-700">
                    {libraryHome.personalized.boxItems.length} recovery kit items linked
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-emerald-100/80 bg-white/85 p-5">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">
                    Search the approved library
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Try wound care, swelling, showering, pain medicine, or walking.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void runSearch(query);
                      }
                    }}
                    placeholder="Search recovery topics"
                    className="h-12 rounded-2xl border-black/8 bg-stone-50/60 pl-11 text-[15px] shadow-none focus-visible:ring-emerald-600"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TOPICS.slice(0, 4).map((topic) => (
                    <Button
                      key={topic}
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-emerald-100 bg-emerald-50/50 px-3 text-sm text-emerald-900 hover:bg-emerald-100"
                      onClick={() => void runSearch(topic)}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-10 rounded-full px-4"
                    onClick={() => void runSearch(query)}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching…
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Search
                      </>
                    )}
                  </Button>

                  {hasSearched ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 rounded-full px-4 text-muted-foreground hover:bg-stone-100"
                      onClick={clearSearch}
                    >
                      Back to library
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </header>

      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50/70 p-4 text-sm leading-6 text-rose-950">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Searching the recovery library
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Pulling general recovery guidance for “{query.trim() || "your topic"}”.
              </p>
            </div>
          </div>
        </Card>
      ) : isBlockedState ? (
        <div className="space-y-4">
          <Card className="rounded-[30px] border border-rose-200 bg-rose-50/70 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-rose-950">
                  Contact your clinic for personal guidance
                </h2>
                <p className="text-sm leading-6 text-rose-950/90">{results?.message}</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="space-y-4">
              <div className="text-sm font-semibold text-foreground">
                Try a general recovery topic instead
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map((topic) => (
                  <Button
                    key={topic}
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full border-emerald-100 bg-emerald-50/50 px-4 text-sm text-emerald-900 hover:bg-emerald-100"
                    onClick={() => void runSearch(topic)}
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      ) : isNoMatchState ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              No close match yet
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{results?.message}</p>
          </div>
        </Card>
      ) : isSuccessState ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Search results
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {results?.message}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {results?.results.map((result) => (
              <SearchResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      ) : libraryLoading ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Loading your library
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Pulling Frederick Recovery guides, videos, and category sections.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-7">
          <GuideSection
            title="Recommended for Your Recovery"
            description="Marked guides from Frederick Recovery appear here first so the most important next reads stay easy to find."
            guides={recommendedGuides}
            emptyLabel="Frederick Recovery has not marked any recommended guides yet. The full library is still available below."
          />

          {personalizedProcedureGuides.length > 0 ? (
            <GuideSection
              title="For your procedure"
              description="These guides are matched to the procedure on your profile."
              guides={personalizedProcedureGuides}
              emptyLabel=""
            />
          ) : null}

          {personalizedBoxGuides.length > 0 ? (
            <GuideSection
              title="For your recovery kit"
              description="These instructions are tied to the supplies in your box."
              guides={personalizedBoxGuides}
              emptyLabel=""
            />
          ) : null}

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Browse by category
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Open the library the way patients naturally look for help: start here, box item,
                procedure, clinic instruction, or video.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryCards.map((category) => {
                const meta = RECOVERY_LIBRARY_CATEGORY_META[category.key];
                const Icon = meta.icon;

                return (
                  <Link key={category.key} to={`/medical-hub/categories/${category.key}`}>
                    <Card className="h-full rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition-transform duration-150 hover:-translate-y-0.5">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${meta.iconClassName}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                            {category.moduleCount}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="text-lg font-semibold tracking-tight text-foreground">
                            {category.title}
                          </h3>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {category.description}
                          </p>
                        </div>

                        {category.featuredGuides[0] ? (
                          <div className="rounded-[22px] border border-stone-200/80 bg-stone-50/80 p-4">
                            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Featured
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {category.featuredGuides[0].title}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          <GuideSection
            title="Start here"
            description="A small first set of guides for the earliest, most common recovery questions."
            guides={startHere}
            emptyLabel="Frederick Recovery has not added start-here guides yet."
          />

          <GuideSection
            title="Common recovery topics"
            description="The calm, broad guidance patients tend to revisit most."
            guides={commonTopics}
            emptyLabel="No common recovery guides are active yet."
          />

          <GuideSection
            title="Videos"
            description="Visual learning for patients who want to watch first and read second."
            guides={videos}
            emptyLabel="No videos are attached yet."
          />

          <GuideSection
            title="Clinic instructions"
            description="Frederick Recovery custom instructions and follow-up reminders."
            guides={clinicInstructions}
            emptyLabel="No clinic-specific instructions are active yet."
          />
        </div>
      )}

      <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              Educational information only
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              This library shares general recovery education only. For personal symptoms, urgent
              concerns, or individualized instructions, contact your clinic directly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
