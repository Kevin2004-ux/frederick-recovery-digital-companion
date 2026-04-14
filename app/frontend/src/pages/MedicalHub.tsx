import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpenText,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EducationArticle = {
  id: string;
  title: string;
  snippet: string;
  summary: string;
  paragraphs: string[];
  keyPoints: string[];
  url: string;
};

type EducationSearchResult = {
  query: string;
  articles: EducationArticle[];
  cached: boolean;
};

function formatError(error: unknown) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "VALIDATION_ERROR") {
    return "Enter at least 2 characters to search for a topic.";
  }

  return "We couldn’t load education topics right now. Please try again.";
}

export default function MedicalHub() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("surgery recovery");
  const [activeQuery, setActiveQuery] = useState("surgery recovery");
  const [results, setResults] = useState<EducationSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  function runSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 2) {
      setError("Enter at least 2 characters to search for a topic.");
      return;
    }

    setActiveQuery(trimmed);
    setHasSearched(true);
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadEducation() {
      setLoading(true);
      setError(null);

      try {
        const payload = await api<EducationSearchResult>(
          `/education/search?q=${encodeURIComponent(activeQuery)}`,
          { method: "GET", signal: controller.signal }
        );

        if (!active) return;
        setResults(payload);
      } catch (err) {
        if (!active) return;

        const apiError = err as Partial<ApiError>;
        if (apiError?.name === "AbortError") return;

        setResults(null);
        setError(formatError(err));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadEducation();

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeQuery]);

  useEffect(() => {
    setHasSearched(true);
  }, []);

  const articleCountLabel = useMemo(() => {
    const count = results?.articles.length ?? 0;
    if (count === 1) return "1 article";
    return `${count} articles`;
  }, [results?.articles.length]);

  const showInitialState = !loading && !error && !results && !hasSearched;
  const showEmptyState =
    !loading && !error && hasSearched && (results?.articles.length ?? 0) === 0;

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
            Education Hub
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Search trusted recovery education and general health topics in a calmer, easier-to-read format.
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
                  Search trusted health education
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Try topics like swelling, wound care, constipation, or pain medicine.
                </p>
              </div>
            </div>

            {results ? (
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                {articleCountLabel}
                {results.cached ? " • cached" : ""}
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
                  runSearch(query);
                }
              }}
              placeholder="Search recovery topics"
              className="h-12 rounded-2xl border-black/8 bg-stone-50/60 pl-11 text-[15px] shadow-none focus-visible:ring-emerald-600"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              className="h-10 rounded-full px-4"
              onClick={() => runSearch(query)}
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
                Searching education topics
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Pulling trusted health education for “{activeQuery}”.
              </p>
            </div>
          </div>
        </Card>
      ) : showInitialState ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Search className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Start with a simple topic
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Search for a symptom, recovery task, or medication topic to see trusted articles from MedlinePlus.
              </p>
            </div>
          </div>
        </Card>
      ) : showEmptyState ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                No articles found
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Try a broader term or a simpler phrase to search the education library.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {results?.articles.map((article) => (
            <Card
              key={article.id}
              className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6"
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-800">
                    MedlinePlus
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {article.title}
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {article.snippet || article.summary}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-emerald-100/80 bg-emerald-50/40 p-4">
                  <div className="text-sm font-semibold text-foreground">Overview</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {article.summary}
                  </p>
                </div>

                {article.keyPoints.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">
                      Key points
                    </div>
                    <ul className="space-y-2">
                      {article.keyPoints.slice(0, 4).map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {article.paragraphs.length > 1 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">
                      More to know
                    </div>
                    <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                      {article.paragraphs.slice(1, 3).map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-full px-4"
                    onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open source article
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}

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
              This hub shares general health education only. Follow your clinic’s instructions for your own recovery, and use the MedlinePlus source article if you want the full reference.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
