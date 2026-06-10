import {
  BookOpenText,
  Boxes,
  FolderKanban,
  Loader2,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { api } from "@/api/client";
import type {
  BoxTemplate,
  BoxTemplatePreviewPayload,
  EducationBundle,
  EducationBundlePreviewPayload,
  RecoveryLibraryAdminGuideSummary,
  RecoveryLibraryAdminModule,
  RecoveryLibraryAdminPayload,
  RecoveryLibraryCategoryKey,
} from "@/types";

type GuideFormState = {
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

type BundleAssignmentFormState = {
  moduleId: string;
  recommended: boolean;
  featured: boolean;
  recommendationLabel: string;
  recommendationOrder: string;
  displayOrder: string;
};

type BundleFormState = {
  name: string;
  description: string;
  procedureName: string;
  displayOrder: string;
  active: boolean;
  modules: BundleAssignmentFormState[];
};

type BoxTemplateAssignmentFormState = {
  moduleId: string;
  recommended: boolean;
  recommendationLabel: string;
  recommendationOrder: string;
};

type BoxTemplateFormState = {
  name: string;
  description: string;
  boxItemKeys: string;
  displayOrder: string;
  active: boolean;
  modules: BoxTemplateAssignmentFormState[];
};

const EMPTY_GUIDE_FORM: GuideFormState = {
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

const EMPTY_BUNDLE_FORM: BundleFormState = {
  name: "",
  description: "",
  procedureName: "",
  displayOrder: "0",
  active: true,
  modules: [],
};

const EMPTY_BOX_TEMPLATE_FORM: BoxTemplateFormState = {
  name: "",
  description: "",
  boxItemKeys: "",
  displayOrder: "0",
  active: true,
  modules: [],
};

function toCommaSeparated(values: string[]) {
  return values.join(", ");
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

function matchesGuideQuery(module: RecoveryLibraryAdminModule, normalizedQuery: string) {
  if (!normalizedQuery) return true;

  return (
    module.title.toLowerCase().includes(normalizedQuery) ||
    module.id.toLowerCase().includes(normalizedQuery) ||
    module.categories.some((category) => category.includes(normalizedQuery)) ||
    (module.recommendationLabel ?? "").toLowerCase().includes(normalizedQuery)
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

function sortBundles(bundles: EducationBundle[]) {
  return [...bundles].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.name.localeCompare(right.name);
  });
}

function sortBoxTemplates(boxTemplates: BoxTemplate[]) {
  return [...boxTemplates].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.name.localeCompare(right.name);
  });
}

function compareBundleAssignments(
  left: BundleAssignmentFormState,
  right: BundleAssignmentFormState
) {
  const leftOrder = Number(left.displayOrder);
  const rightOrder = Number(right.displayOrder);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.moduleId.localeCompare(right.moduleId);
}

function compareBoxTemplateAssignments(
  left: BoxTemplateAssignmentFormState,
  right: BoxTemplateAssignmentFormState
) {
  const leftOrder =
    left.recommendationOrder.trim() === "" ? Number.MAX_SAFE_INTEGER : Number(left.recommendationOrder);
  const rightOrder =
    right.recommendationOrder.trim() === ""
      ? Number.MAX_SAFE_INTEGER
      : Number(right.recommendationOrder);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.moduleId.localeCompare(right.moduleId);
}

function fromGuideModule(module: RecoveryLibraryAdminModule): GuideFormState {
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

function fromBundle(bundle: EducationBundle): BundleFormState {
  return {
    name: bundle.name,
    description: bundle.description,
    procedureName: bundle.procedureName ?? "",
    displayOrder: String(bundle.displayOrder),
    active: bundle.active,
    modules: [...bundle.modules]
      .sort((left, right) => left.displayOrder - right.displayOrder || left.moduleId.localeCompare(right.moduleId))
      .map((assignment) => ({
        moduleId: assignment.moduleId,
        recommended: assignment.recommended,
        featured: assignment.featured,
        recommendationLabel: assignment.recommendationLabel ?? "",
        recommendationOrder:
          assignment.recommendationOrder === null || assignment.recommendationOrder === undefined
            ? ""
            : String(assignment.recommendationOrder),
        displayOrder: String(assignment.displayOrder),
      })),
  };
}

function fromBoxTemplate(boxTemplate: BoxTemplate): BoxTemplateFormState {
  return {
    name: boxTemplate.name,
    description: boxTemplate.description,
    boxItemKeys: toCommaSeparated(boxTemplate.boxItemKeys),
    displayOrder: String(boxTemplate.displayOrder),
    active: boxTemplate.active,
    modules: [...boxTemplate.modules]
      .sort((left, right) => {
        const leftOrder = left.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder || left.moduleId.localeCompare(right.moduleId);
      })
      .map((assignment) => ({
        moduleId: assignment.moduleId,
        recommended: assignment.recommended,
        recommendationLabel: assignment.recommendationLabel ?? "",
        recommendationOrder:
          assignment.recommendationOrder === null || assignment.recommendationOrder === undefined
            ? ""
            : String(assignment.recommendationOrder),
      })),
  };
}

function ModulePicker(props: {
  title: string;
  query: string;
  onQueryChange: (value: string) => void;
  modules: RecoveryLibraryAdminModule[];
  selectedIds: Set<string>;
  onAdd: (moduleId: string) => void;
}) {
  const filtered = props.modules
    .filter((module) => matchesGuideQuery(module, props.query.trim().toLowerCase()))
    .filter((module) => !props.selectedIds.has(module.id))
    .slice(0, 8);

  return (
    <div className="field">
      <span>{props.title}</span>
      <div className="library-picker-shell">
        <div className="library-picker-search">
          <Search size={16} />
          <input
            type="text"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder="Search existing library guides"
          />
        </div>

        <div className="library-picker-results">
          {filtered.length === 0 ? (
            <div className="library-picker-empty">No matching guides available to add.</div>
          ) : (
            filtered.map((module) => (
              <button
                key={module.id}
                type="button"
                className="library-picker-result"
                onClick={() => props.onAdd(module.id)}
              >
                <div>
                  <strong>{module.title}</strong>
                  <span>
                    {module.id} · {module.type}
                  </span>
                </div>
                <span className="library-picker-add">Add</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewGuideCards(props: {
  title: string;
  description: string;
  guides: RecoveryLibraryAdminGuideSummary[];
}) {
  return (
    <div className="library-preview-panel">
      <div className="section-heading">
        <div>
          <h3>{props.title}</h3>
          <p className="muted">{props.description}</p>
        </div>
      </div>
      {props.guides.length === 0 ? (
        <div className="inline-note">
          <span>No guides in this preview yet.</span>
        </div>
      ) : (
        <div className="library-preview-grid">
          {props.guides.map((guide) => (
            <article key={guide.id} className="library-preview-card">
              <div className="library-preview-card-top">
                <strong>{guide.title}</strong>
                {guide.featured ? (
                  <span className="library-meta-pill featured">Featured</span>
                ) : guide.recommended ? (
                  <span className="library-meta-pill recommended">Recommended</span>
                ) : null}
              </div>
              <div className="library-module-row-meta">
                <span>{guide.id}</span>
                <span>{guide.type}</span>
                {guide.recommendationLabel ? (
                  <span className="library-meta-pill label">{guide.recommendationLabel}</span>
                ) : null}
              </div>
              <p className="muted">{guide.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecoveryLibraryPage() {
  const [payload, setPayload] = useState<RecoveryLibraryAdminPayload | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [guideCreateMode, setGuideCreateMode] = useState(false);
  const [guideForm, setGuideForm] = useState<GuideFormState>(EMPTY_GUIDE_FORM);
  const [guideQuery, setGuideQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [guideNotice, setGuideNotice] = useState("");

  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [bundleCreateMode, setBundleCreateMode] = useState(false);
  const [bundleForm, setBundleForm] = useState<BundleFormState>(EMPTY_BUNDLE_FORM);
  const [bundleListQuery, setBundleListQuery] = useState("");
  const [bundleModuleQuery, setBundleModuleQuery] = useState("");
  const [bundleSaving, setBundleSaving] = useState(false);
  const [bundleError, setBundleError] = useState("");
  const [bundleNotice, setBundleNotice] = useState("");
  const [bundlePreview, setBundlePreview] = useState<EducationBundlePreviewPayload | null>(null);
  const [bundlePreviewLoading, setBundlePreviewLoading] = useState(false);

  const [selectedBoxTemplateId, setSelectedBoxTemplateId] = useState<string | null>(null);
  const [boxTemplateCreateMode, setBoxTemplateCreateMode] = useState(false);
  const [boxTemplateForm, setBoxTemplateForm] = useState<BoxTemplateFormState>(EMPTY_BOX_TEMPLATE_FORM);
  const [boxTemplateListQuery, setBoxTemplateListQuery] = useState("");
  const [boxTemplateModuleQuery, setBoxTemplateModuleQuery] = useState("");
  const [boxTemplateSaving, setBoxTemplateSaving] = useState(false);
  const [boxTemplateError, setBoxTemplateError] = useState("");
  const [boxTemplateNotice, setBoxTemplateNotice] = useState("");
  const [boxTemplatePreview, setBoxTemplatePreview] = useState<BoxTemplatePreviewPayload | null>(null);
  const [boxTemplatePreviewLoading, setBoxTemplatePreviewLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLibraryAdmin() {
      setLoading(true);
      setGuideError("");

      try {
        const response = await api.get<RecoveryLibraryAdminPayload>("/education/library/admin");
        if (!active) return;

        const modules = sortModules(response.modules);
        const bundles = sortBundles(response.bundles);
        const boxTemplates = sortBoxTemplates(response.boxTemplates);

        setPayload({
          ...response,
          modules,
          bundles,
          boxTemplates,
        });
        setSelectedGuideId(modules[0]?.id ?? null);
        setSelectedBundleId(bundles[0]?.id ?? null);
        setSelectedBoxTemplateId(boxTemplates[0]?.id ?? null);
      } catch (err) {
        if (!active) return;
        setGuideError(err instanceof Error ? err.message : "Unable to load the recovery library.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLibraryAdmin();

    return () => {
      active = false;
    };
  }, []);

  const modulesById = useMemo(
    () => new Map((payload?.modules ?? []).map((module) => [module.id, module])),
    [payload?.modules]
  );

  const filteredGuides = useMemo(() => {
    const modules = payload?.modules ?? [];
    const normalized = guideQuery.trim().toLowerCase();
    if (!normalized) return modules;
    return modules.filter((module) => matchesGuideQuery(module, normalized));
  }, [payload?.modules, guideQuery]);

  const filteredBundles = useMemo(() => {
    const bundles = payload?.bundles ?? [];
    const normalized = bundleListQuery.trim().toLowerCase();
    if (!normalized) return bundles;
    return bundles.filter((bundle) => {
      return (
        bundle.name.toLowerCase().includes(normalized) ||
        bundle.slug.toLowerCase().includes(normalized) ||
        (bundle.procedureName ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [payload?.bundles, bundleListQuery]);

  const filteredBoxTemplates = useMemo(() => {
    const boxTemplates = payload?.boxTemplates ?? [];
    const normalized = boxTemplateListQuery.trim().toLowerCase();
    if (!normalized) return boxTemplates;
    return boxTemplates.filter((boxTemplate) => {
      return (
        boxTemplate.name.toLowerCase().includes(normalized) ||
        boxTemplate.slug.toLowerCase().includes(normalized) ||
        boxTemplate.boxItemKeys.some((boxItemKey) => boxItemKey.includes(normalized))
      );
    });
  }, [payload?.boxTemplates, boxTemplateListQuery]);

  const selectedGuide = useMemo(
    () => payload?.modules.find((module) => module.id === selectedGuideId) ?? null,
    [payload?.modules, selectedGuideId]
  );

  const selectedBundle = useMemo(
    () => payload?.bundles.find((bundle) => bundle.id === selectedBundleId) ?? null,
    [payload?.bundles, selectedBundleId]
  );

  const selectedBoxTemplate = useMemo(
    () => payload?.boxTemplates.find((boxTemplate) => boxTemplate.id === selectedBoxTemplateId) ?? null,
    [payload?.boxTemplates, selectedBoxTemplateId]
  );

  useEffect(() => {
    if (guideCreateMode || !selectedGuide) return;
    setGuideForm(fromGuideModule(selectedGuide));
  }, [guideCreateMode, selectedGuide]);

  useEffect(() => {
    if (bundleCreateMode || !selectedBundle) return;
    setBundleForm(fromBundle(selectedBundle));
  }, [bundleCreateMode, selectedBundle]);

  useEffect(() => {
    if (boxTemplateCreateMode || !selectedBoxTemplate) return;
    setBoxTemplateForm(fromBoxTemplate(selectedBoxTemplate));
  }, [boxTemplateCreateMode, selectedBoxTemplate]);

  useEffect(() => {
    let active = true;

    async function loadBundlePreview() {
      if (bundleCreateMode || !selectedBundleId) {
        setBundlePreview(null);
        return;
      }

      setBundlePreviewLoading(true);
      try {
        const response = await api.get<EducationBundlePreviewPayload>(
          `/education/library/admin/bundles/${selectedBundleId}/preview`
        );
        if (!active) return;
        setBundlePreview(response);
      } catch {
        if (!active) return;
        setBundlePreview(null);
      } finally {
        if (active) setBundlePreviewLoading(false);
      }
    }

    void loadBundlePreview();

    return () => {
      active = false;
    };
  }, [bundleCreateMode, selectedBundleId]);

  useEffect(() => {
    let active = true;

    async function loadBoxTemplatePreview() {
      if (boxTemplateCreateMode || !selectedBoxTemplateId) {
        setBoxTemplatePreview(null);
        return;
      }

      setBoxTemplatePreviewLoading(true);
      try {
        const response = await api.get<BoxTemplatePreviewPayload>(
          `/education/library/admin/box-templates/${selectedBoxTemplateId}/preview`
        );
        if (!active) return;
        setBoxTemplatePreview(response);
      } catch {
        if (!active) return;
        setBoxTemplatePreview(null);
      } finally {
        if (active) setBoxTemplatePreviewLoading(false);
      }
    }

    void loadBoxTemplatePreview();

    return () => {
      active = false;
    };
  }, [boxTemplateCreateMode, selectedBoxTemplateId]);

  function beginCreateGuide() {
    const nextOrder =
      (payload?.modules.reduce((max, module) => Math.max(max, module.displayOrder), 0) ?? 0) + 10;

    setGuideCreateMode(true);
    setSelectedGuideId(null);
    setGuideNotice("");
    setGuideForm({
      ...EMPTY_GUIDE_FORM,
      displayOrder: String(nextOrder),
    });
  }

  function beginEditGuide(moduleId: string) {
    setGuideCreateMode(false);
    setSelectedGuideId(moduleId);
    setGuideNotice("");
  }

  function beginCreateBundle() {
    const nextOrder =
      (payload?.bundles.reduce((max, bundle) => Math.max(max, bundle.displayOrder), 0) ?? 0) + 10;

    setBundleCreateMode(true);
    setSelectedBundleId(null);
    setBundleNotice("");
    setBundlePreview(null);
    setBundleForm({
      ...EMPTY_BUNDLE_FORM,
      displayOrder: String(nextOrder),
    });
  }

  function beginEditBundle(bundleId: string) {
    setBundleCreateMode(false);
    setSelectedBundleId(bundleId);
    setBundleNotice("");
  }

  function beginCreateBoxTemplate() {
    const nextOrder =
      (payload?.boxTemplates.reduce((max, boxTemplate) => Math.max(max, boxTemplate.displayOrder), 0) ?? 0) + 10;

    setBoxTemplateCreateMode(true);
    setSelectedBoxTemplateId(null);
    setBoxTemplateNotice("");
    setBoxTemplatePreview(null);
    setBoxTemplateForm({
      ...EMPTY_BOX_TEMPLATE_FORM,
      displayOrder: String(nextOrder),
    });
  }

  function beginEditBoxTemplate(boxTemplateId: string) {
    setBoxTemplateCreateMode(false);
    setSelectedBoxTemplateId(boxTemplateId);
    setBoxTemplateNotice("");
  }

  function updateGuideCategory(category: RecoveryLibraryCategoryKey, checked: boolean) {
    setGuideForm((current) => ({
      ...current,
      categories: checked
        ? Array.from(new Set([...current.categories, category]))
        : current.categories.filter((value) => value !== category),
    }));
  }

  function addBundleModule(moduleId: string) {
    const module = modulesById.get(moduleId);
    if (!module) return;

    setBundleForm((current) => {
      if (current.modules.some((assignment) => assignment.moduleId === moduleId)) {
        return current;
      }

      return {
        ...current,
        modules: [...current.modules, {
          moduleId,
          recommended: false,
          featured: false,
          recommendationLabel: "",
          recommendationOrder: "",
          displayOrder: String(module.displayOrder),
        }].sort(compareBundleAssignments),
      };
    });
    setBundleModuleQuery("");
  }

  function updateBundleModule(
    moduleId: string,
    updater: (assignment: BundleAssignmentFormState) => BundleAssignmentFormState
  ) {
    setBundleForm((current) => ({
      ...current,
      modules: current.modules
        .map((assignment) =>
          assignment.moduleId === moduleId ? updater(assignment) : assignment
        )
        .sort(compareBundleAssignments),
    }));
  }

  function removeBundleModule(moduleId: string) {
    setBundleForm((current) => ({
      ...current,
      modules: current.modules.filter((assignment) => assignment.moduleId !== moduleId),
    }));
  }

  function addBoxTemplateModule(moduleId: string) {
    if (!modulesById.has(moduleId)) return;

    setBoxTemplateForm((current) => {
      if (current.modules.some((assignment) => assignment.moduleId === moduleId)) {
        return current;
      }

      return {
        ...current,
        modules: [...current.modules, {
          moduleId,
          recommended: false,
          recommendationLabel: "",
          recommendationOrder: "",
        }].sort(compareBoxTemplateAssignments),
      };
    });
    setBoxTemplateModuleQuery("");
  }

  function updateBoxTemplateModule(
    moduleId: string,
    updater: (assignment: BoxTemplateAssignmentFormState) => BoxTemplateAssignmentFormState
  ) {
    setBoxTemplateForm((current) => ({
      ...current,
      modules: current.modules
        .map((assignment) =>
          assignment.moduleId === moduleId ? updater(assignment) : assignment
        )
        .sort(compareBoxTemplateAssignments),
    }));
  }

  function removeBoxTemplateModule(moduleId: string) {
    setBoxTemplateForm((current) => ({
      ...current,
      modules: current.modules.filter((assignment) => assignment.moduleId !== moduleId),
    }));
  }

  async function handleGuideSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuideSaving(true);
    setGuideError("");
    setGuideNotice("");

    try {
      if (!guideCreateMode && !selectedGuideId) {
        throw new Error("Select a guide to edit or start a new guide.");
      }

      const requestBody = {
        title: guideForm.title.trim(),
        summary: guideForm.summary.trim(),
        body: guideForm.body.trim(),
        moduleType: guideForm.moduleType,
        videoUrl: guideForm.videoUrl.trim(),
        thumbnailUrl: guideForm.thumbnailUrl.trim(),
        recommended: guideForm.recommended,
        featured: guideForm.featured,
        recommendationLabel: guideForm.recommendationLabel.trim(),
        recommendationOrder:
          guideForm.recommendationOrder.trim() === ""
            ? null
            : Number(guideForm.recommendationOrder),
        displayOrder: Number(guideForm.displayOrder),
        active: guideForm.active,
        categories: guideForm.categories,
        procedureNames: splitInputValues(guideForm.procedureNames),
        boxItemKeys: splitInputValues(guideForm.boxItemKeys),
      };

      const response = guideCreateMode
        ? await api.post<{ module: RecoveryLibraryAdminModule }>(
            "/education/library/admin/modules",
            requestBody
          )
        : await api.put<{ module: RecoveryLibraryAdminModule }>(
            `/education/library/admin/modules/${selectedGuideId}`,
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

      setGuideCreateMode(false);
      setSelectedGuideId(response.module.id);
      setGuideForm(fromGuideModule(response.module));
      if (
        guideCreateMode &&
        guideQuery.trim() &&
        !matchesGuideQuery(response.module, guideQuery.trim().toLowerCase())
      ) {
        setGuideQuery("");
      }
      setGuideNotice(
        guideCreateMode
          ? "Guide created. You can keep editing it below."
          : "Guide saved."
      );
    } catch (err) {
      setGuideError(err instanceof Error ? err.message : "Unable to save guide.");
    } finally {
      setGuideSaving(false);
    }
  }

  async function handleBundleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBundleSaving(true);
    setBundleError("");
    setBundleNotice("");

    try {
      if (!bundleCreateMode && !selectedBundleId) {
        throw new Error("Select a bundle to edit or start a new bundle.");
      }

      const requestBody = {
        name: bundleForm.name.trim(),
        description: bundleForm.description.trim(),
        procedureName: bundleForm.procedureName.trim(),
        displayOrder: Number(bundleForm.displayOrder),
        active: bundleForm.active,
        modules: bundleForm.modules.map((assignment) => ({
          moduleId: assignment.moduleId,
          recommended: assignment.recommended,
          featured: assignment.featured,
          recommendationLabel: assignment.recommendationLabel.trim(),
          recommendationOrder:
            assignment.recommendationOrder.trim() === ""
              ? null
              : Number(assignment.recommendationOrder),
          displayOrder: Number(assignment.displayOrder),
        })),
      };

      const response = bundleCreateMode
        ? await api.post<{ bundle: EducationBundle }>(
            "/education/library/admin/bundles",
            requestBody
          )
        : await api.put<{ bundle: EducationBundle }>(
            `/education/library/admin/bundles/${selectedBundleId}`,
            requestBody
          );

      setPayload((current) => {
        if (!current) return current;

        const nextBundles = sortBundles(
          current.bundles.some((bundle) => bundle.id === response.bundle.id)
            ? current.bundles.map((bundle) =>
                bundle.id === response.bundle.id ? response.bundle : bundle
              )
            : [...current.bundles, response.bundle]
        );

        return {
          ...current,
          bundles: nextBundles,
        };
      });

      setBundleCreateMode(false);
      setSelectedBundleId(response.bundle.id);
      setBundleForm(fromBundle(response.bundle));
      setBundleNotice(
        bundleCreateMode ? "Education bundle created." : "Education bundle saved."
      );
    } catch (err) {
      setBundleError(err instanceof Error ? err.message : "Unable to save bundle.");
    } finally {
      setBundleSaving(false);
    }
  }

  async function handleBoxTemplateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBoxTemplateSaving(true);
    setBoxTemplateError("");
    setBoxTemplateNotice("");

    try {
      if (!boxTemplateCreateMode && !selectedBoxTemplateId) {
        throw new Error("Select a box template to edit or start a new template.");
      }

      const requestBody = {
        name: boxTemplateForm.name.trim(),
        description: boxTemplateForm.description.trim(),
        boxItemKeys: splitInputValues(boxTemplateForm.boxItemKeys),
        displayOrder: Number(boxTemplateForm.displayOrder),
        active: boxTemplateForm.active,
        modules: boxTemplateForm.modules.map((assignment) => ({
          moduleId: assignment.moduleId,
          recommended: assignment.recommended,
          recommendationLabel: assignment.recommendationLabel.trim(),
          recommendationOrder:
            assignment.recommendationOrder.trim() === ""
              ? null
              : Number(assignment.recommendationOrder),
        })),
      };

      const response = boxTemplateCreateMode
        ? await api.post<{ boxTemplate: BoxTemplate }>(
            "/education/library/admin/box-templates",
            requestBody
          )
        : await api.put<{ boxTemplate: BoxTemplate }>(
            `/education/library/admin/box-templates/${selectedBoxTemplateId}`,
            requestBody
          );

      setPayload((current) => {
        if (!current) return current;

        const nextTemplates = sortBoxTemplates(
          current.boxTemplates.some((boxTemplate) => boxTemplate.id === response.boxTemplate.id)
            ? current.boxTemplates.map((boxTemplate) =>
                boxTemplate.id === response.boxTemplate.id ? response.boxTemplate : boxTemplate
              )
            : [...current.boxTemplates, response.boxTemplate]
        );

        return {
          ...current,
          boxTemplates: nextTemplates,
        };
      });

      setBoxTemplateCreateMode(false);
      setSelectedBoxTemplateId(response.boxTemplate.id);
      setBoxTemplateForm(fromBoxTemplate(response.boxTemplate));
      setBoxTemplateNotice(
        boxTemplateCreateMode ? "Box template created." : "Box template saved."
      );
    } catch (err) {
      setBoxTemplateError(err instanceof Error ? err.message : "Unable to save box template.");
    } finally {
      setBoxTemplateSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recovery Library Admin</p>
            <h1>Frederick Recovery library, bundles, and box templates</h1>
            <p className="muted">
              Manage the global guide catalog, reusable procedure bundles, and reusable recovery
              box templates without changing activation code logic yet.
            </p>
          </div>
          <div className="hero-actions">
            <button className="button secondary" type="button" onClick={beginCreateGuide}>
              <Plus size={16} />
              New guide
            </button>
            <button className="button secondary" type="button" onClick={beginCreateBundle}>
              <FolderKanban size={16} />
              New bundle
            </button>
            <button className="button secondary" type="button" onClick={beginCreateBoxTemplate}>
              <Boxes size={16} />
              New box template
            </button>
          </div>
        </div>

        <div className="inline-note">
          <span>Guides stay reusable across the library, bundles, and box templates.</span>
          <span>Activation-code assignment is intentionally still out of scope for this phase.</span>
        </div>
      </section>

      {loading ? (
        <section className="panel">
          <div className="inline-note">
            <span>Loading recovery library admin…</span>
            <Loader2 size={18} className="spin" />
          </div>
        </section>
      ) : guideError && !payload ? (
        <section className="panel">
          <div className="alert error">{guideError}</div>
        </section>
      ) : payload ? (
        <div className="library-section-stack">
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
                  value={guideQuery}
                  onChange={(event) => setGuideQuery(event.target.value)}
                  placeholder="Search by title, id, or category"
                />
              </label>

              <div className="library-module-list">
                {filteredGuides.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    className={`library-module-row ${
                      selectedGuideId === module.id && !guideCreateMode ? "selected" : ""
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
                      <span>
                        {module.source === "custom"
                          ? "Custom"
                          : module.isCustomized
                          ? "Customized"
                          : "Built-in"}
                      </span>
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

            <form className="panel form-stack" onSubmit={handleGuideSubmit}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{guideCreateMode ? "Create" : "Edit"}</p>
                  <h2>{guideCreateMode ? "New guide" : selectedGuide?.title ?? "Guide editor"}</h2>
                  <p className="muted">
                    {guideCreateMode
                      ? "New custom guide for Frederick Recovery."
                      : selectedGuide?.source === "content_library" && !selectedGuide?.isCustomized
                      ? "Saving creates an owner override on top of the built-in content library module."
                      : "Editing the saved guide configuration."}
                  </p>
                </div>
              </div>

              {guideNotice ? <div className="alert success">{guideNotice}</div> : null}
              {guideError && payload ? <div className="alert error">{guideError}</div> : null}

              <div className="grid-two library-form-grid">
                <label className="field">
                  <span>Guide title</span>
                  <input
                    type="text"
                    value={guideForm.title}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Pain medicine after surgery"
                    required
                  />
                </label>

                <label className="field">
                  <span>Module type</span>
                  <select
                    value={guideForm.moduleType}
                    onChange={(event) =>
                      setGuideForm((current) => ({
                        ...current,
                        moduleType: event.target.value as GuideFormState["moduleType"],
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
                  value={guideForm.summary}
                  onChange={(event) =>
                    setGuideForm((current) => ({ ...current, summary: event.target.value }))
                  }
                  rows={3}
                  placeholder="A short one-paragraph overview for the card view."
                />
              </label>

              <label className="field">
                <span>Guide body</span>
                <textarea
                  value={guideForm.body}
                  onChange={(event) =>
                    setGuideForm((current) => ({ ...current, body: event.target.value }))
                  }
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
                    value={guideForm.videoUrl}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, videoUrl: event.target.value }))
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </label>

                <label className="field">
                  <span>Thumbnail URL</span>
                  <input
                    type="url"
                    value={guideForm.thumbnailUrl}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, thumbnailUrl: event.target.value }))
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
                    checked={guideForm.recommended}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, recommended: event.target.checked }))
                    }
                  />
                </label>

                <label className="library-toggle">
                  <span>Starred guide</span>
                  <input
                    type="checkbox"
                    checked={guideForm.featured}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, featured: event.target.checked }))
                    }
                  />
                </label>
              </div>

              <div className="grid-two library-form-grid">
                <label className="field">
                  <span>Recommendation label</span>
                  <input
                    type="text"
                    value={guideForm.recommendationLabel}
                    maxLength={80}
                    onChange={(event) =>
                      setGuideForm((current) => ({
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
                    value={guideForm.recommendationOrder}
                    min={0}
                    max={10000}
                    onChange={(event) =>
                      setGuideForm((current) => ({
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
                    value={guideForm.displayOrder}
                    min={0}
                    max={10000}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, displayOrder: event.target.value }))
                    }
                  />
                </label>

                <label className="library-toggle">
                  <span>Visible in library</span>
                  <input
                    type="checkbox"
                    checked={guideForm.active}
                    onChange={(event) =>
                      setGuideForm((current) => ({ ...current, active: event.target.checked }))
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
                        checked={guideForm.categories.includes(category.key)}
                        onChange={(event) =>
                          updateGuideCategory(category.key, event.target.checked)
                        }
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
                  value={guideForm.procedureNames}
                  onChange={(event) =>
                    setGuideForm((current) => ({ ...current, procedureNames: event.target.value }))
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
                        setGuideForm((current) => ({
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
                  value={guideForm.boxItemKeys}
                  onChange={(event) =>
                    setGuideForm((current) => ({ ...current, boxItemKeys: event.target.value }))
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
                        setGuideForm((current) => ({
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
                  Use category assignment for browse pages, bundle assignment for reusable procedure
                  sets, and box template assignment for physical kit education.
                </span>
                <BookOpenText size={18} />
              </div>

              <div className="form-actions">
                <button className="button primary" type="submit" disabled={guideSaving}>
                  {guideSaving ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {guideCreateMode ? "Create guide" : "Save guide"}
                    </>
                  )}
                </button>

                {!guideCreateMode ? (
                  <button className="button secondary" type="button" onClick={beginCreateGuide}>
                    <Plus size={16} />
                    New guide
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="library-admin-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Education Bundles</p>
                  <h2>{payload.bundles.length} reusable bundles</h2>
                </div>
              </div>

              <label className="field">
                <span>Search bundles</span>
                <input
                  type="text"
                  value={bundleListQuery}
                  onChange={(event) => setBundleListQuery(event.target.value)}
                  placeholder="Search by bundle name, slug, or procedure"
                />
              </label>

              <div className="library-module-list">
                {filteredBundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    className={`library-module-row ${
                      selectedBundleId === bundle.id && !bundleCreateMode ? "selected" : ""
                    }`}
                    onClick={() => beginEditBundle(bundle.id)}
                  >
                    <div className="library-module-row-top">
                      <div className="library-module-title">{bundle.name}</div>
                      <div className={`status-pill ${bundle.active ? "active" : "inactive"}`}>
                        {bundle.active ? "Active" : "Inactive"}
                      </div>
                    </div>
                    <div className="library-module-row-meta">
                      <span>{bundle.slug}</span>
                      {bundle.procedureName ? <span>{bundle.procedureName}</span> : null}
                      <span>{bundle.moduleCount} guides</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form className="panel form-stack" onSubmit={handleBundleSubmit}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{bundleCreateMode ? "Create" : "Edit"}</p>
                  <h2>{bundleCreateMode ? "New bundle" : selectedBundle?.name ?? "Bundle editor"}</h2>
                  <p className="muted">
                    Build reusable procedure-specific or general post-op guide folders without
                    tying them to activation codes yet.
                  </p>
                </div>
              </div>

              {bundleNotice ? <div className="alert success">{bundleNotice}</div> : null}
              {bundleError ? <div className="alert error">{bundleError}</div> : null}

              <div className="grid-two library-form-grid">
                <label className="field">
                  <span>Bundle name</span>
                  <input
                    type="text"
                    value={bundleForm.name}
                    onChange={(event) =>
                      setBundleForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Knee Replacement"
                    required
                  />
                </label>

                <label className="field">
                  <span>Procedure name</span>
                  <input
                    type="text"
                    value={bundleForm.procedureName}
                    onChange={(event) =>
                      setBundleForm((current) => ({
                        ...current,
                        procedureName: event.target.value,
                      }))
                    }
                    placeholder="knee replacement"
                  />
                </label>
              </div>

              <label className="field">
                <span>Description</span>
                <textarea
                  value={bundleForm.description}
                  onChange={(event) =>
                    setBundleForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Reusable recovery education set for a common procedure."
                />
              </label>

              <div className="grid-two library-form-grid">
                <label className="field">
                  <span>Display order</span>
                  <input
                    type="number"
                    value={bundleForm.displayOrder}
                    min={0}
                    max={10000}
                    onChange={(event) =>
                      setBundleForm((current) => ({
                        ...current,
                        displayOrder: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="library-toggle">
                  <span>Active bundle</span>
                  <input
                    type="checkbox"
                    checked={bundleForm.active}
                    onChange={(event) =>
                      setBundleForm((current) => ({ ...current, active: event.target.checked }))
                    }
                  />
                </label>
              </div>

              <ModulePicker
                title="Add existing guides to this bundle"
                query={bundleModuleQuery}
                onQueryChange={setBundleModuleQuery}
                modules={payload.modules}
                selectedIds={new Set(bundleForm.modules.map((assignment) => assignment.moduleId))}
                onAdd={addBundleModule}
              />

              <div className="field">
                <span>Bundle guide assignments</span>
                <div className="library-assignment-stack">
                  {bundleForm.modules.length === 0 ? (
                    <div className="library-picker-empty">
                      Add guides to create a reusable education bundle.
                    </div>
                  ) : (
                    [...bundleForm.modules]
                      .sort(compareBundleAssignments)
                      .map((assignment) => {
                        const module = modulesById.get(assignment.moduleId);
                        return (
                          <div key={assignment.moduleId} className="library-assignment-card">
                            <div className="library-assignment-header">
                              <div>
                                <strong>{module?.title ?? assignment.moduleId}</strong>
                                <span>{assignment.moduleId}</span>
                              </div>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => removeBundleModule(assignment.moduleId)}
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <div className="grid-two library-form-grid">
                              <label className="library-toggle">
                                <span>Recommended</span>
                                <input
                                  type="checkbox"
                                  checked={assignment.recommended}
                                  onChange={(event) =>
                                    updateBundleModule(assignment.moduleId, (current) => ({
                                      ...current,
                                      recommended: event.target.checked,
                                    }))
                                  }
                                />
                              </label>

                              <label className="library-toggle">
                                <span>Featured</span>
                                <input
                                  type="checkbox"
                                  checked={assignment.featured}
                                  onChange={(event) =>
                                    updateBundleModule(assignment.moduleId, (current) => ({
                                      ...current,
                                      featured: event.target.checked,
                                    }))
                                  }
                                />
                              </label>
                            </div>

                            <div className="grid-two library-form-grid">
                              <label className="field">
                                <span>Recommendation label</span>
                                <input
                                  type="text"
                                  value={assignment.recommendationLabel}
                                  maxLength={80}
                                  onChange={(event) =>
                                    updateBundleModule(assignment.moduleId, (current) => ({
                                      ...current,
                                      recommendationLabel: event.target.value,
                                    }))
                                  }
                                  placeholder="For knee recovery"
                                />
                              </label>

                              <label className="field">
                                <span>Recommendation order</span>
                                <input
                                  type="number"
                                  value={assignment.recommendationOrder}
                                  min={0}
                                  max={10000}
                                  onChange={(event) =>
                                    updateBundleModule(assignment.moduleId, (current) => ({
                                      ...current,
                                      recommendationOrder: event.target.value,
                                    }))
                                  }
                                  placeholder="10"
                                />
                              </label>
                            </div>

                            <label className="field">
                              <span>Bundle display order</span>
                              <input
                                type="number"
                                value={assignment.displayOrder}
                                min={0}
                                max={10000}
                                onChange={(event) =>
                                  updateBundleModule(assignment.moduleId, (current) => ({
                                    ...current,
                                    displayOrder: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button className="button primary" type="submit" disabled={bundleSaving}>
                  {bundleSaving ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {bundleCreateMode ? "Create bundle" : "Save bundle"}
                    </>
                  )}
                </button>

                {!bundleCreateMode ? (
                  <button className="button secondary" type="button" onClick={beginCreateBundle}>
                    <Plus size={16} />
                    New bundle
                  </button>
                ) : null}
              </div>

              {bundlePreviewLoading ? (
                <div className="inline-note">
                  <span>Loading bundle preview…</span>
                  <Loader2 size={18} className="spin" />
                </div>
              ) : bundlePreview ? (
                <div className="library-preview-stack">
                  <PreviewGuideCards
                    title="Bundle preview: Recommended"
                    description="How the top recommended section would look for this bundle."
                    guides={bundlePreview.recommendedGuides}
                  />
                  <PreviewGuideCards
                    title="Bundle preview: All assigned guides"
                    description="All guides in this bundle, sorted by bundle display order."
                    guides={bundlePreview.guides}
                  />
                </div>
              ) : null}
            </form>
          </section>

          <section className="library-admin-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Box Templates</p>
                  <h2>{payload.boxTemplates.length} reusable box templates</h2>
                </div>
              </div>

              <label className="field">
                <span>Search box templates</span>
                <input
                  type="text"
                  value={boxTemplateListQuery}
                  onChange={(event) => setBoxTemplateListQuery(event.target.value)}
                  placeholder="Search by template name, slug, or box item"
                />
              </label>

              <div className="library-module-list">
                {filteredBoxTemplates.map((boxTemplate) => (
                  <button
                    key={boxTemplate.id}
                    type="button"
                    className={`library-module-row ${
                      selectedBoxTemplateId === boxTemplate.id && !boxTemplateCreateMode
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => beginEditBoxTemplate(boxTemplate.id)}
                  >
                    <div className="library-module-row-top">
                      <div className="library-module-title">{boxTemplate.name}</div>
                      <div className={`status-pill ${boxTemplate.active ? "active" : "inactive"}`}>
                        {boxTemplate.active ? "Active" : "Inactive"}
                      </div>
                    </div>
                    <div className="library-module-row-meta">
                      <span>{boxTemplate.slug}</span>
                      <span>{boxTemplate.boxItemKeys.length} items</span>
                      <span>{boxTemplate.moduleCount} guides</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form className="panel form-stack" onSubmit={handleBoxTemplateSubmit}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{boxTemplateCreateMode ? "Create" : "Edit"}</p>
                  <h2>
                    {boxTemplateCreateMode
                      ? "New box template"
                      : selectedBoxTemplate?.name ?? "Box template editor"}
                  </h2>
                  <p className="muted">
                    Build reusable kit configurations with assigned items and linked recovery
                    education.
                  </p>
                </div>
              </div>

              {boxTemplateNotice ? <div className="alert success">{boxTemplateNotice}</div> : null}
              {boxTemplateError ? <div className="alert error">{boxTemplateError}</div> : null}

              <div className="grid-two library-form-grid">
                <label className="field">
                  <span>Template name</span>
                  <input
                    type="text"
                    value={boxTemplateForm.name}
                    onChange={(event) =>
                      setBoxTemplateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Knee Recovery Box Template"
                    required
                  />
                </label>

                <label className="field">
                  <span>Display order</span>
                  <input
                    type="number"
                    value={boxTemplateForm.displayOrder}
                    min={0}
                    max={10000}
                    onChange={(event) =>
                      setBoxTemplateForm((current) => ({
                        ...current,
                        displayOrder: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Description</span>
                <textarea
                  value={boxTemplateForm.description}
                  onChange={(event) =>
                    setBoxTemplateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Reusable physical kit setup with linked recovery education."
                />
              </label>

              <div className="grid-two library-form-grid">
                <label className="field">
                  <span>Box item keys</span>
                  <textarea
                    value={boxTemplateForm.boxItemKeys}
                    onChange={(event) =>
                      setBoxTemplateForm((current) => ({
                        ...current,
                        boxItemKeys: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="icepack, gauze, tape, compression_socks"
                  />
                  <div className="tag-cloud">
                    {payload.suggestions.boxItems.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="chip-button"
                        onClick={() =>
                          setBoxTemplateForm((current) => ({
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

                <label className="library-toggle">
                  <span>Active box template</span>
                  <input
                    type="checkbox"
                    checked={boxTemplateForm.active}
                    onChange={(event) =>
                      setBoxTemplateForm((current) => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                  />
                </label>
              </div>

              <ModulePicker
                title="Attach existing guides to this box template"
                query={boxTemplateModuleQuery}
                onQueryChange={setBoxTemplateModuleQuery}
                modules={payload.modules}
                selectedIds={new Set(boxTemplateForm.modules.map((assignment) => assignment.moduleId))}
                onAdd={addBoxTemplateModule}
              />

              <div className="field">
                <span>Box template guide assignments</span>
                <div className="library-assignment-stack">
                  {boxTemplateForm.modules.length === 0 ? (
                    <div className="library-picker-empty">
                      Attach guides that should travel with this box template later.
                    </div>
                  ) : (
                    [...boxTemplateForm.modules]
                      .sort(compareBoxTemplateAssignments)
                      .map((assignment) => {
                        const module = modulesById.get(assignment.moduleId);
                        return (
                          <div key={assignment.moduleId} className="library-assignment-card">
                            <div className="library-assignment-header">
                              <div>
                                <strong>{module?.title ?? assignment.moduleId}</strong>
                                <span>{assignment.moduleId}</span>
                              </div>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => removeBoxTemplateModule(assignment.moduleId)}
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <label className="library-toggle">
                              <span>Recommended in template</span>
                              <input
                                type="checkbox"
                                checked={assignment.recommended}
                                onChange={(event) =>
                                  updateBoxTemplateModule(assignment.moduleId, (current) => ({
                                    ...current,
                                    recommended: event.target.checked,
                                  }))
                                }
                              />
                            </label>

                            <div className="grid-two library-form-grid">
                              <label className="field">
                                <span>Recommendation label</span>
                                <input
                                  type="text"
                                  value={assignment.recommendationLabel}
                                  maxLength={80}
                                  onChange={(event) =>
                                    updateBoxTemplateModule(assignment.moduleId, (current) => ({
                                      ...current,
                                      recommendationLabel: event.target.value,
                                    }))
                                  }
                                  placeholder="Box item"
                                />
                              </label>

                              <label className="field">
                                <span>Recommendation order</span>
                                <input
                                  type="number"
                                  value={assignment.recommendationOrder}
                                  min={0}
                                  max={10000}
                                  onChange={(event) =>
                                    updateBoxTemplateModule(assignment.moduleId, (current) => ({
                                      ...current,
                                      recommendationOrder: event.target.value,
                                    }))
                                  }
                                  placeholder="10"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button className="button primary" type="submit" disabled={boxTemplateSaving}>
                  {boxTemplateSaving ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {boxTemplateCreateMode ? "Create box template" : "Save box template"}
                    </>
                  )}
                </button>

                {!boxTemplateCreateMode ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={beginCreateBoxTemplate}
                  >
                    <Plus size={16} />
                    New box template
                  </button>
                ) : null}
              </div>

              {boxTemplatePreviewLoading ? (
                <div className="inline-note">
                  <span>Loading box template preview…</span>
                  <Loader2 size={18} className="spin" />
                </div>
              ) : boxTemplatePreview ? (
                <div className="library-preview-stack">
                  <div className="inline-note">
                    <span>
                      Box items: {boxTemplatePreview.boxTemplate.boxItemKeys.join(", ") || "None assigned yet"}
                    </span>
                  </div>
                  <PreviewGuideCards
                    title="Box template preview: Recommended"
                    description="Recommended guides that would surface first for this template later."
                    guides={boxTemplatePreview.recommendedGuides}
                  />
                  <PreviewGuideCards
                    title="Box template preview: All attached guides"
                    description="All guides currently attached to this template."
                    guides={boxTemplatePreview.guides}
                  />
                </div>
              ) : null}
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
