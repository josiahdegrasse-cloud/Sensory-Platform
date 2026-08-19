export interface DraftLineage {
  id?: string | null;
  evidenceBundleId?: string | null;
}

export interface RestorableConceptDraft {
  draft?: unknown;
  sourceDecision?: DraftLineage | null;
  savedAt?: string | null;
}

export function conceptDraftMatchesLineage(
  saved: RestorableConceptDraft | null | undefined,
  requested: DraftLineage | null | undefined,
): boolean {
  if (!saved?.draft || !saved.sourceDecision?.id || !saved.sourceDecision.evidenceBundleId) return false;
  if (!requested) return true;
  return saved.sourceDecision.id === requested.id
    || saved.sourceDecision.evidenceBundleId === requested.evidenceBundleId;
}

export function chooseNewestConceptDraft<TDraft extends RestorableConceptDraft>(input: {
  browser: TDraft | null;
  workspace: TDraft | null;
  workspaceUpdatedAt?: string | null;
}): TDraft | null {
  const browserTime = Date.parse(input.browser?.savedAt ?? '') || 0;
  const workspaceTime = Date.parse(input.workspace?.savedAt ?? input.workspaceUpdatedAt ?? '') || 0;
  return input.browser && browserTime > workspaceTime ? input.browser : input.workspace;
}
