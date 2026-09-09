import {
  buildWorkoutTemplateRevision,
  cloneWorkoutTemplateSnapshot,
  type WorkoutTemplate,
} from "./workoutTemplateOperations";
import {
  validateWorkoutTemplateForWrite,
  type WorkoutTemplateIssue,
} from "./workoutTemplateContract";

export const WORKOUT_SESSION_TEMPLATE_DRAFT_SCHEMA_VERSION = 1 as const;

export type WorkoutTemplateDraftMode = "create" | "edit";

export type WorkoutTemplateDraftState = {
  mode: WorkoutTemplateDraftMode;
  original: WorkoutTemplate | null;
  draft: WorkoutTemplate;
  baseRevision: string | null;
};

export type WorkoutTemplateDraftAction =
  | { type: "replace_draft"; draft: WorkoutTemplate }
  | { type: "rebase"; current: WorkoutTemplate };

export type WorkoutTemplateCommitResolution =
  | { status: "applied"; template: WorkoutTemplate }
  | { status: "conflict"; current: WorkoutTemplate; draft: WorkoutTemplate }
  | { status: "missing"; draft: WorkoutTemplate };

export type WorkoutTemplateValidation =
  | { valid: true; value: WorkoutTemplate; issues: [] }
  | { valid: false; value: null; issues: WorkoutTemplateIssue[] };

export type WorkoutSessionTemplateDraftRecord = {
  schema_version: typeof WORKOUT_SESSION_TEMPLATE_DRAFT_SCHEMA_VERSION;
  session_id: string;
  template_id: string;
  base_revision: string;
  draft_revision: number;
  draft: WorkoutTemplate;
};

export function createWorkoutTemplateDraft(
  template: WorkoutTemplate,
  mode: WorkoutTemplateDraftMode,
): WorkoutTemplateDraftState {
  const snapshot = cloneWorkoutTemplateSnapshot(template);
  return {
    mode,
    original: mode === "edit" ? cloneWorkoutTemplateSnapshot(template) : null,
    draft: snapshot,
    baseRevision: mode === "edit" ? buildWorkoutTemplateRevision(template) : null,
  };
}

export function workoutTemplateDraftReducer(
  state: WorkoutTemplateDraftState,
  action: WorkoutTemplateDraftAction,
): WorkoutTemplateDraftState {
  if (action.type === "replace_draft") {
    return { ...state, draft: cloneWorkoutTemplateSnapshot(action.draft) };
  }
  if (isWorkoutTemplateDraftDirty(state)) return state;
  const current = cloneWorkoutTemplateSnapshot(action.current);
  return {
    ...state,
    original: current,
    draft: cloneWorkoutTemplateSnapshot(current),
    baseRevision: buildWorkoutTemplateRevision(current),
  };
}

export function isWorkoutTemplateDraftDirty(state: WorkoutTemplateDraftState): boolean {
  if (state.mode === "create" || !state.original) return true;
  return buildWorkoutTemplateRevision(state.draft) !== state.baseRevision;
}

export function validateWorkoutTemplateDraft(
  template: WorkoutTemplate,
): WorkoutTemplateValidation {
  const result = validateWorkoutTemplateForWrite(template);
  return result.ok
    ? { valid: true, value: result.value, issues: [] }
    : { valid: false, value: null, issues: result.issues };
}

export function resolveWorkoutTemplateCommit(
  state: WorkoutTemplateDraftState,
  current: WorkoutTemplate | null,
  overwriteConflict = false,
): WorkoutTemplateCommitResolution {
  if (state.mode === "create") {
    if (current && !overwriteConflict) {
      return { status: "conflict", current, draft: state.draft };
    }
    return { status: "applied", template: cloneWorkoutTemplateSnapshot(state.draft) };
  }
  if (!current) return { status: "missing", draft: state.draft };
  if (!overwriteConflict && buildWorkoutTemplateRevision(current) !== state.baseRevision) {
    return { status: "conflict", current, draft: state.draft };
  }
  return { status: "applied", template: cloneWorkoutTemplateSnapshot(state.draft) };
}

export function createWorkoutSessionTemplateDraftRecord(
  sessionId: string,
  base: WorkoutTemplate,
): WorkoutSessionTemplateDraftRecord {
  return {
    schema_version: WORKOUT_SESSION_TEMPLATE_DRAFT_SCHEMA_VERSION,
    session_id: sessionId,
    template_id: base.id,
    base_revision: buildWorkoutTemplateRevision(base),
    draft_revision: 0,
    draft: cloneWorkoutTemplateSnapshot(base),
  };
}

export function updateWorkoutSessionTemplateDraft(
  record: WorkoutSessionTemplateDraftRecord,
  update: (draft: WorkoutTemplate) => WorkoutTemplate,
): WorkoutSessionTemplateDraftRecord {
  const nextDraft = update(cloneWorkoutTemplateSnapshot(record.draft));
  if (buildWorkoutTemplateRevision(nextDraft) === buildWorkoutTemplateRevision(record.draft)) {
    return record;
  }
  return {
    ...record,
    draft_revision: record.draft_revision + 1,
    draft: cloneWorkoutTemplateSnapshot(nextDraft),
  };
}

/** Proyecta el borrador como plantilla de ejecución aunque la canónica ya no exista. */
export function withWorkoutSessionTemplateDraft(
  templates: readonly WorkoutTemplate[],
  record: WorkoutSessionTemplateDraftRecord | null,
): WorkoutTemplate[] {
  if (!record) return [...templates];
  const existing = templates.some((template) => template.id === record.template_id);
  if (!existing) return [...templates, record.draft];
  return templates.map((template) =>
    template.id === record.template_id ? record.draft : template);
}

export function parseWorkoutSessionTemplateDraftRecord(
  raw: unknown,
): WorkoutSessionTemplateDraftRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<WorkoutSessionTemplateDraftRecord>;
  if (
    value.schema_version !== WORKOUT_SESSION_TEMPLATE_DRAFT_SCHEMA_VERSION
    || typeof value.session_id !== "string"
    || typeof value.template_id !== "string"
    || typeof value.base_revision !== "string"
    || typeof value.draft_revision !== "number"
    || !Number.isInteger(value.draft_revision)
    || value.draft_revision < 0
    || !value.draft
    || typeof value.draft !== "object"
    || value.draft.id !== value.template_id
    || !Array.isArray(value.draft.exercises)
  ) return null;
  try {
    return {
      schema_version: WORKOUT_SESSION_TEMPLATE_DRAFT_SCHEMA_VERSION,
      session_id: value.session_id,
      template_id: value.template_id,
      base_revision: value.base_revision,
      draft_revision: value.draft_revision,
      draft: cloneWorkoutTemplateSnapshot(value.draft),
    };
  } catch {
    return null;
  }
}
