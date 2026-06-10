import { BookOpenText, Loader2, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import type {
  RecoveryLibraryAdminModule,
  RecoveryLibraryAdminPayload,
  RecoveryLibraryCategoryKey,
} from "@/types";

type FormState = {
  title: string;
  summary: string;
  body: string;
  moduleType: "education" | "task" | "milestone";
  videoUrl: string;
  thumbnailUrl: string;
  recommended: boolean;
  featured: boolean;
  recommendationLabel: string;
  recommendationOrder: string;
  displayOrder: string;
  active: boolean;
  categories: RecoveryLibraryCategoryKey[];
  procedureNames: string;
  boxItemKeys: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  body: "",
  moduleType: "education",
  videoUrl: "",
  thumbnailUrl: "",
  recommended: false,
  featured: false,
  recommendationLabel: "",
  recommendationOrder: "",
  displayOrder: "0",
  active: true,
  categories: ["start-here"],
  procedureNames: "",
  boxItemKeys: "",
};

function toCommaSeparated(values: string[]) {
  return values.join(", ");
}

function fromModule(module: RecoveryLibraryAdminModule): FormState {
  return {
    title: module.title,
    summary: module.summary,
    body: module.text,
    moduleType: module.type,
    videoUrl: module.videoUrl ?? "",
    thumbnailUrl: module.thumbnailUrl ?? "",
    recommended: module.recommended,
    featured: module.featured,
    recommendationLabel: module.recommendationLabel ?? "",
    recommendationOrder:
      module.recommendationOrder === null || module.recommendationOrder === undefined
        ? ""
        : String(module.recommendationOrder),
    displayOrder: String(module.displayOrder),
    active: module.active,
    categories: module.categories,
    procedureNames: toCommaSeparated(module.procedureNames),
    boxItemKeys: toCommaSeparated(module.boxItemKeys),
  };
}

function matchesGuideQuery(module: RecoveryLibraryAdminModule, normalizedQuery: string) {
  if (!normalizedQuery) return true;

  return (
    module.title.toLowerCase().includes(normalizedQuery) ||
    module.id.toLowerCase().includes(normalizedQuery) ||
    module.categories.some((category) => category.includes(normalizedQuery)) ||
    (module.recommendationLabel ?? "").toLowerCase().includes(normalizedQuery)
  );
}

function splitInputValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(/,|\n/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function sortModules(modules: RecoveryLibraryAdminModule[]) {
  return [...modules].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.title.localeCompare(right.title);
  });
}

export default function RecoveryLibraryPage() {
  const [payload, setPayload] = useState<RecoveryLibraryAdminPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLibraryAdmin() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get<RecoveryLibraryAdminPayload>("/education/library/admin");
        if (!active) return;
        const sortedModules = sortModules(response.modules);
        setPayload({
          ...response,
          modules: sortedModules,
        });
        setSelectedId(sortedModules[0]?.id ?? null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load the recovery library.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLibraryAdmin();

    return () => {
      active = false;
    };
  }, []);

  const filteredModules = useMemo(() => {
    const modules = payload?.modules ?? [];
    const normalized = query.trim().toLowerCase();

    if (!normalized) return modules;

    return modules.filter((module) => matchesGuideQuery(module, normalized));
  }, [payload?.modules, query]);

  const selectedModule = useMemo(
    () => payload?.modules.find((module) => module.id === selectedId) ?? null,
    [payload?.modules, selectedId]
  );

  useEffect(() => {
    if (createMode) return;
    if (!selectedModule) return;
    setForm(fromModule(selectedModule));
  }, [createMode, selectedModule]);

  function beginCreateGuide() {
    const nextOrder =
      (payload?.modules.reduce((max, module) => Math.max(max, module.displayOrder), 0) ?? 0) + 10;

    setCreateMode(true);
    setSelectedId(null);
    setNotice("");
    setForm({
      ...EMPTY_FORM,
      displayOrder: String(nextOrder),
    });
  }

  function beginEditGuide(moduleId: string) {
    setCreateMode(false);
    setSelectedId(moduleId);
    setNotice("");
  }

  function updateCategory(category: RecoveryLibraryCategoryKey, checked: boolean) {
    setForm((current) => ({
      ...current,
      categories: checked
        ? Array.from(new Set([...current.categories, category]))
        : current.categories.filter((value) => value !== category),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (!createMode && !selectedId) {
        throw new Error("Select a guide to edit or start a new guide.");
      }

      const requestBody = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        moduleType: form.moduleType,
        videoUrl: form.videoUrl.trim(),
        thumbnailUrl: form.thumbnailUrl.trim(),
        recommended: form.recommended,
        featured: form.featured,
        recommendationLabel: form.recommendationLabel.trim(),
        recommendationOrder:
          form.recommendationOrder.trim() === ""
            ? null
            : Number(form.recommendationOrder),
        displayOrder: Number(form.displayOrder),
        active: form.active,
        categories: form.categories,
        procedureNames: splitInputValues(form.procedureNames),
        boxItemKeys: splitInputValues(form.boxItemKeys),
      };

      const response = createMode
        ? await api.post<{ module: RecoveryLibraryAdminModule }>(
            "/education/library/admin/modules",
            requestBody
          )
        : await api.put<{ module: RecoveryLibraryAdminModule }>(
            `/education/library/admin/modules/${selectedId}`,
            requestBody
          );

      setPayload((current) => {
        if (!current) return current;

        const nextModules = sortModules(
          current.modules.some((module) => module.id === response.module.id)
            ? current.modules.map((module) =>
                module.id === response.module.id ? response.module : module
              )
            : [...current.modules, response.module]
        );

        return {
          ...current,
          modules: nextModules,
        };
      });

      setCreateMode(false);
      setSelectedId(response.module.id);
      setForm(fromModule(response.module));
      if (
        createMode &&
        query.trim() &&
        !matchesGuideQuery(response.module, query.trim().toLowerCase())
      ) {
        setQuery("");
      }
      setNotice(
        createMode
          ? "Guide created. You can keep editing it below."
          : "Guide saved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save guide.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recovery Library Admin</p>
            <h1>Frederick Recovery guide editor</h1>
            <p className="muted">
              Create new guides or override the built-in content library without rebuilding the
              platform.
            </p>
          </div>
          <button className="button secondary" type="button" onClick={beginCreateGuide}>
            <Plus size={16} />
            New guide
          </button>
        </div>

        <div className="inline-note">
          <span>Categories, procedure assignments, box item assignments, videos, and ordering all live here.</span>
          <span>Built-in guides stay reusable in the full platform and kit-only experience.</span>
        </div>
      </section>

      {loading ? (
        <section className="panel">
          <div className="inline-note">
            <span>Loading recovery library admin…</span>
            <Loader2 size={18} className="spin" />
          </div>
        </section>
      ) : error && !payload ? (
        <section className="panel">
          <div className="alert error">{error}</div>
        </section>
      ) : payload ? (
        <section className="library-admin-grid">
          <div className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Guides</p>
                <h2>{payload.modules.length} total modules</h2>
              </div>
            </div>

            <label className="field">
              <span>Search guides</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, id, or category"
              />
            </label>

            <div className="library-module-list">
              {filteredModules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  className={`library-module-row ${
                    selectedId === module.id && !createMode ? "selected" : ""
                  }`}
                  onClick={() => beginEditGuide(module.id)}
                >
                  <div className="library-module-row-top">
                    <div className="library-module-title">{module.title}</div>
                    <div className={`status-pill ${module.active ? "active" : "inactive"}`}>
                      {module.active ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div className="library-module-row-meta">
                    <span>{module.id}</span>
                    <span>{module.type}</span>
                    <span>{module.source === "custom" ? "Custom" : module.isCustomized ? "Customized" : "Built-in"}</span>
                    {module.featured ? <span className="library-meta-pill featured">Starred</span> : null}
                    {module.recommended ? (
                      <span className="library-meta-pill recommended">Recommended</span>
                    ) : null}
                    {module.recommendationLabel ? (
                      <span className="library-meta-pill label">{module.recommendationLabel}</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form className="panel form-stack" onSubmit={handleSubmit}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{createMode ? "Create" : "Edit"}</p>
                <h2>{createMode ? "New guide" : selectedModule?.title ?? "Guide editor"}</h2>
                <p className="muted">
                  {createMode
                    ? "New custom guide for Frederick Recovery."
                    : selectedModule?.source === "content_library" && !selectedModule?.isCustomized
                    ? "Saving creates an owner override on top of the built-in content library module."
                    : "Editing the saved guide configuration."}
                </p>
              </div>
            </div>

            {notice ? <div className="alert success">{notice}</div> : null}
            {error && payload ? <div className="alert error">{error}</div> : null}

            <div className="grid-two library-form-grid">
              <label className="field">
                <span>Guide title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Pain medicine after surgery"
                  required
                />
              </label>

              <label className="field">
                <span>Module type</span>
                <select
                  value={form.moduleType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      moduleType: event.target.value as FormState["moduleType"],
                    }))
                  }
                >
                  <option value="education">Guide</option>
                  <option value="task">Instruction</option>
                  <option value="milestone">Next step</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Summary</span>
              <textarea
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                rows={3}
                placeholder="A short one-paragraph overview for the card view."
              />
            </label>

            <label className="field">
              <span>Guide body</span>
              <textarea
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                rows={8}
                placeholder="Write the full guide content here. Separate paragraphs with blank lines."
                required
              />
            </label>

            <div className="grid-two library-form-grid">
              <label className="field">
                <span>Video URL</span>
                <input
                  type="url"
                  value={form.videoUrl}
                  onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>

              <label className="field">
                <span>Thumbnail URL</span>
                <input
                  type="url"
                  value={form.thumbnailUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))
                  }
                  placeholder="https://..."
                />
              </label>
            </div>

            <div className="grid-two library-form-grid">
              <label className="library-toggle">
                <span>Recommended guide</span>
                <input
                  type="checkbox"
                  checked={form.recommended}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, recommended: event.target.checked }))
                  }
                />
              </label>

              <label className="library-toggle">
                <span>Starred guide</span>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, featured: event.target.checked }))
                  }
                />
              </label>
            </div>

            <div className="grid-two library-form-grid">
              <label className="field">
                <span>Recommendation label</span>
                <input
                  type="text"
                  value={form.recommendationLabel}
                  maxLength={80}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recommendationLabel: event.target.value,
                    }))
                  }
                  placeholder="Start here, Important, For knee recovery"
                />
              </label>

              <label className="field">
                <span>Recommendation order</span>
                <input
                  type="number"
                  value={form.recommendationOrder}
                  min={0}
                  max={10000}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recommendationOrder: event.target.value,
                    }))
                  }
                  placeholder="10"
                />
              </label>
            </div>

            <div className="grid-two library-form-grid">
              <label className="field">
                <span>Display order</span>
                <input
                  type="number"
                  value={form.displayOrder}
                  min={0}
                  max={10000}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, displayOrder: event.target.value }))
                  }
                />
              </label>

              <label className="library-toggle">
                <span>Visible in library</span>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                />
              </label>
            </div>

            <div className="field">
              <span>Categories</span>
              <div className="library-checkbox-grid">
                {payload.categories.map((category) => (
                  <label key={category.key} className="library-checkbox">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(category.key)}
                      onChange={(event) => updateCategory(category.key, event.target.checked)}
                    />
                    <div>
                      <strong>{category.title}</strong>
                      <span>{category.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Assigned procedures</span>
              <textarea
                value={form.procedureNames}
                onChange={(event) =>
                  setForm((current) => ({ ...current, procedureNames: event.target.value }))
                }
                rows={3}
                placeholder="hip replacement, knee replacement"
              />
              <div className="tag-cloud">
                {payload.suggestions.procedures.map((procedure) => (
                  <button
                    key={procedure}
                    type="button"
                    className="chip-button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        procedureNames: splitInputValues(
                          [current.procedureNames, procedure].filter(Boolean).join(", ")
                        ).join(", "),
                      }))
                    }
                  >
                    {procedure}
                  </button>
                ))}
              </div>
            </label>

            <label className="field">
              <span>Assigned box items</span>
              <textarea
                value={form.boxItemKeys}
                onChange={(event) =>
                  setForm((current) => ({ ...current, boxItemKeys: event.target.value }))
                }
                rows={3}
                placeholder="icepack, scar_gel, compression_socks"
              />
              <div className="tag-cloud">
                {payload.suggestions.boxItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="chip-button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        boxItemKeys: splitInputValues(
                          [current.boxItemKeys, item].filter(Boolean).join(", ")
                        ).join(", "),
                      }))
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </label>

            <div className="inline-note">
              <span>
                Use category assignment for browse pages, procedure assignment for personalized
                procedure sections, and box item assignment for recovery kit sections.
              </span>
              <BookOpenText size={18} />
            </div>

            <div className="form-actions">
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {createMode ? "Create guide" : "Save guide"}
                  </>
                )}
              </button>

              {!createMode ? (
                <button className="button secondary" type="button" onClick={beginCreateGuide}>
                  <Plus size={16} />
                  New guide
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
