import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ConceptTest, DecisionRecord } from '../lib/database';
import { fetchConceptResponsesForTests } from '../lib/database';
import {
  useFormulationVersions,
  useImportBatches,
  useInstrumentalDataset,
  usePanelists,
  useProducts,
  useResponsesForProducts,
  useWorkspaceSettings,
} from '../lib/hooks';
import {
  buildProjectDataSheets,
  PROJECT_DATA_SECTION_DEFINITIONS,
  type ProjectDataSectionKey,
} from '../lib/project-data-export';
import { downloadCommercializationDataWorkbook } from '../lib/commercialization-data-export';
import { DEFAULT_REPORT_ORGANIZATION_NAME, DEFAULT_REPORT_WORKSPACE_NAME } from '../lib/commercialization-report';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';

const GROUPS = ['Project', 'Participants', 'Food & science'] as const;
const ALL_KEYS = new Set(PROJECT_DATA_SECTION_DEFINITIONS.map(item => item.key));

export function ProjectDataExportSheet({
  projectId,
  decisions,
  concepts,
}: {
  projectId?: string;
  decisions: DecisionRecord[];
  concepts: ConceptTest[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<ProjectDataSectionKey>>(() => new Set(ALL_KEYS));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const productsQuery = useProducts(open);
  const panelistsQuery = usePanelists(open);
  const batchesQuery = useImportBatches(open);
  const instrumentalQuery = useInstrumentalDataset(open);
  const formulationsQuery = useFormulationVersions(projectId, open);
  const settingsQuery = useWorkspaceSettings();

  const projectBatches = useMemo(() => (batchesQuery.data ?? []).filter(batch => !projectId || batch.projectId === projectId), [batchesQuery.data, projectId]);
  const projectBatchIds = useMemo(() => new Set(projectBatches.map(batch => batch.id)), [projectBatches]);
  const projectProducts = useMemo(() => (productsQuery.data ?? []).filter(product => (
    !projectId
    || product.projectId === projectId
    || Boolean(product.sourceImportBatchId && projectBatchIds.has(product.sourceImportBatchId))
  )), [productsQuery.data, projectBatchIds, projectId]);
  const productIds = useMemo(() => projectProducts.map(product => product.id), [projectProducts]);
  const foodResponsesQuery = useResponsesForProducts(productIds, open);

  const projectDecisions = useMemo(() => decisions.filter(decision => !projectId || decision.projectId === projectId), [decisions, projectId]);
  const projectDecisionIds = useMemo(() => new Set(projectDecisions.map(decision => decision.id)), [projectDecisions]);
  const projectConcepts = useMemo(() => concepts.filter(concept => (
    !projectId
    || concept.projectId === projectId
    || Boolean(concept.decisionRecordId && projectDecisionIds.has(concept.decisionRecordId))
  )), [concepts, projectDecisionIds, projectId]);
  const conceptIds = useMemo(() => projectConcepts.map(concept => concept.id).sort(), [projectConcepts]);
  const conceptResponsesQuery = useQuery({
    queryKey: ['projectExportConceptResponses', projectId ?? 'all', ...conceptIds],
    queryFn: () => fetchConceptResponsesForTests(conceptIds),
    enabled: open && conceptIds.length > 0,
  });

  const instrumentalSampleIds = useMemo(() => {
    const linkedSampleIds = new Set([
      ...projectProducts.map(product => product.sourceSampleId).filter((value): value is string => Boolean(value)),
      ...projectDecisions.map(decision => decision.sampleId),
    ]);
    return new Set((instrumentalQuery.data?.eTongueData ?? [])
      .filter(sample => !projectId || linkedSampleIds.has(sample.sampleId) || Boolean(sample.importBatchId && projectBatchIds.has(sample.importBatchId)))
      .map(sample => sample.sampleId));
  }, [instrumentalQuery.data?.eTongueData, projectBatchIds, projectDecisions, projectId, projectProducts]);

  const projectName = projectBatches.find(batch => batch.projectName)?.projectName
    ?? (projectId ? `Project ${projectId.slice(0, 8)}` : 'All project data');
  const settings = settingsQuery.data;
  const sheets = useMemo(() => buildProjectDataSheets({
    projectId,
    projectName,
    organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
    workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
    anonymizePanelists: settings?.anonymizePanelistsInReports ?? true,
    products: projectProducts,
    foodPanelResponses: foodResponsesQuery.data ?? [],
    panelists: panelistsQuery.data ?? [],
    concepts: projectConcepts,
    conceptResponses: conceptResponsesQuery.data ?? [],
    decisions: projectDecisions,
    instrumentalDataset: instrumentalQuery.data,
    instrumentalSampleIds,
    formulationVersions: formulationsQuery.data ?? [],
  }), [
    conceptResponsesQuery.data,
    foodResponsesQuery.data,
    formulationsQuery.data,
    instrumentalQuery.data,
    instrumentalSampleIds,
    panelistsQuery.data,
    projectConcepts,
    projectDecisions,
    projectId,
    projectName,
    projectProducts,
    settings?.anonymizePanelistsInReports,
    settings?.organizationName,
    settings?.workspaceName,
  ]);

  const sheetByKey = useMemo(() => new Map(sheets.map(sheet => [sheet.key, sheet])), [sheets]);
  const availableKeys = useMemo(() => new Set(sheets.filter(sheet => sheet.rows.length > 0).map(sheet => sheet.key as ProjectDataSectionKey)), [sheets]);
  const selectedSheets = useMemo(() => sheets.filter(sheet => selectedKeys.has(sheet.key as ProjectDataSectionKey) && sheet.rows.length > 0), [selectedKeys, sheets]);
  const selectedRows = selectedSheets.reduce((total, sheet) => total + sheet.rows.length, 0);
  const queries = [productsQuery, panelistsQuery, batchesQuery, instrumentalQuery, formulationsQuery, settingsQuery, foodResponsesQuery, conceptResponsesQuery];
  const loading = open && queries.some(query => query.isLoading);
  const hasQueryError = open && queries.some(query => query.isError);

  const toggleSection = (key: ProjectDataSectionKey, checked: boolean) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const retry = () => {
    setError('');
    queries.forEach(query => void query.refetch());
  };

  const exportWorkbook = async () => {
    if (loading || hasQueryError || exporting || selectedSheets.length === 0) return;
    setExporting(true);
    setError('');
    try {
      await downloadCommercializationDataWorkbook({
        sheets: selectedSheets,
        organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
        reportTitle: projectName,
      });
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the project workbook.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline"><FileSpreadsheet className="size-4" />Export data</Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 border-l border-slate-200 bg-white sm:max-w-xl">
        <SheetHeader className="border-b border-slate-200 px-5 py-5 pr-12">
          <SheetTitle className="text-base text-slate-950">Export project data</SheetTitle>
          <SheetDescription className="max-w-md text-slate-600">
            Download the available project records without generating a commercialization report.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm">
          <p className="font-medium text-slate-700">{loading ? 'Loading project data…' : `${availableKeys.size} datasets available`}</p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set(availableKeys))} disabled={loading}>Select all</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set())} disabled={loading}>Clear</Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {hasQueryError && (
            <div className="mt-4 flex items-start justify-between gap-4 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
              <p>Some project data could not be loaded. Retry before exporting.</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}><RefreshCw className="size-4" />Retry</Button>
            </div>
          )}

          <div className="mt-3 flex items-start gap-3 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-700">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <p>Names, email addresses, phone numbers, and postal addresses are excluded. Participant codes follow the workspace privacy setting.</p>
          </div>

          {GROUPS.map(group => (
            <section key={group} className="pt-5" aria-labelledby={`project-export-${group.replace(/\W+/g, '-').toLowerCase()}`}>
              <h3 id={`project-export-${group.replace(/\W+/g, '-').toLowerCase()}`} className="mb-2 text-sm font-semibold text-slate-950">{group}</h3>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {PROJECT_DATA_SECTION_DEFINITIONS.filter(definition => definition.group === group).map(definition => {
                  const rowCount = sheetByKey.get(definition.key)?.rows.length ?? 0;
                  const available = rowCount > 0;
                  const controlId = `project-export-${definition.key}`;
                  return (
                    <label key={definition.key} htmlFor={controlId} className={`flex gap-3 py-3 ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}>
                      <Checkbox
                        id={controlId}
                        className="mt-0.5"
                        checked={available && selectedKeys.has(definition.key)}
                        disabled={!available || loading}
                        onCheckedChange={checked => toggleSection(definition.key, checked === true)}
                        aria-label={`Include ${definition.label}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">{definition.label}</span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-500">{available ? `${rowCount} row${rowCount === 1 ? '' : 's'}` : 'No data'}</span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-600">{definition.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
          {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
        </div>

        <SheetFooter className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-600" aria-live="polite">{selectedSheets.length} sheet{selectedSheets.length === 1 ? '' : 's'} · {selectedRows} rows</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" size="sm" onClick={() => void exportWorkbook()} disabled={loading || hasQueryError || exporting || selectedSheets.length === 0}>
                <Download className="size-4" />{exporting ? 'Preparing…' : 'Export .xlsx'}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
