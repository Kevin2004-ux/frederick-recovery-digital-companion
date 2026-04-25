import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpenText,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type RecoveryHelperSection = {
  title: string;
  body?: string;
  items?: string[];
};

type RecoveryHelperResult = {
  id: string;
  title: string;
  moduleType: "education" | "task" | "tracking" | "milestone";
  summary: string;
  keyPoints: string[];
  sections: RecoveryHelperSection[];
  redFlags: string[];
  frequency?: string;
  requiredBoxItems: string[];
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

function moduleTypeLabel(moduleType: RecoveryHelperResult["moduleType"]) {
  switch (moduleType) {
    case "education":
      return "Guide";
    case "task":
      return "Recovery task";
    case "milestone":
      return "Recovery step";
    case "tracking":
      return "Tracking";
    default:
      return moduleType;
  }
}

export default function MedicalHub() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecoveryHelperSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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

        <div className="space-y-2.5">
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
            Education Hub
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Recovery Helper
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Search the approved recovery library for calm, general guidance about common post-op topics.
          </p>
        </div>
      </header>

      <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <BookOpenText className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  Search common recovery topics
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Try topics like swelling, showering, pain medicine, or when to call your clinic.
                </p>
              </div>
            </div>

            {isSuccessState ? (
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                <Sparkles className="h-4 w-4" />
                Recovery guidance
              </div>
            ) : null}
          </div>

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

          <div className="flex flex-wrap justify-between gap-3">
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
          </div>

          {error ? (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50/70 p-4 text-sm leading-6 text-rose-950">
              {error}
            </div>
          ) : null}
        </div>
      </Card>

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
      ) : !hasSearched ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Search className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Start with a common recovery topic
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choose a topic below or search for a question you want to understand better.
                </p>
              </div>
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
                <p className="text-sm leading-6 text-rose-950/90">
                  {results?.message}
                </p>
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
        <div className="space-y-4">
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  No close match yet
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {results?.message}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="space-y-4">
              <div className="text-sm font-semibold text-foreground">
                Broader topics you can try
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
      ) : isSuccessState ? (
        <div className="space-y-4">
          <Card className="rounded-[30px] border border-emerald-100/80 bg-emerald-50/40 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Recovery Helper answer
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {results?.message}
                </p>
              </div>
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            {results?.results.map((result) => (
              <Card
                key={result.id}
                className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6"
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-800">
                      {moduleTypeLabel(result.moduleType)}
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
                      <div className="text-sm font-semibold text-foreground">
                        Key points
                      </div>
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

                  <div className="space-y-3">
                    {result.sections.map((section) => (
                      <div
                        key={`${result.id}-${section.title}`}
                        className="rounded-[22px] border border-stone-200/80 bg-stone-50/70 p-4"
                      >
                        <div className="text-sm font-semibold text-foreground">
                          {section.title}
                        </div>
                        {section.body ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {section.body}
                          </p>
                        ) : null}
                        {section.items?.length ? (
                          <ul className="mt-3 space-y-2">
                            {section.items.map((item) => (
                              <li
                                key={`${result.id}-${section.title}-${item}`}
                                className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                              >
                                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-stone-400" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {result.redFlags.length > 0 ? (
                    <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 p-4">
                      <div className="text-sm font-semibold text-amber-950">
                        When to contact your clinic
                      </div>
                      <ul className="mt-3 space-y-2">
                        {result.redFlags.map((flag) => (
                          <li
                            key={`${result.id}-${flag}`}
                            className="flex items-start gap-2 text-sm leading-6 text-amber-950/90"
                          >
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500/90" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.frequency || result.requiredBoxItems.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {result.frequency ? (
                        <div className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700">
                          {result.frequency}
                        </div>
                      ) : null}
                      {result.requiredBoxItems.map((item) => (
                        <div
                          key={`${result.id}-item-${item}`}
                          className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </section>
        </div>
      ) : null}

      <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              Educational information only
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              This hub shares general recovery education only. For personal symptoms, urgent concerns, or individualized instructions, contact your clinic directly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
