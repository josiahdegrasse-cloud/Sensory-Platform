import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import type {
  CommercializationReportRecord,
  ConceptTest,
  DecisionRecord,
  InstrumentalDataset,
  WorkspaceSettings,
} from '../lib/database';
import type { CommercializationReportSnapshot } from '../lib/commercialization-report';
import type { EvidenceBundle } from '../lib/report-evidence-types';
import {
  buildCommercializationDataSheets,
  downloadCommercializationDataWorkbook,
  REPORT_DATA_SECTION_DEFINITIONS,
  type ReportDataSectionGroup,
  type ReportDataSectionKey,
} from '../lib/commercialization-data-export';
import {
  useConceptTestResponses,
  useFormulationVersions,
  usePanelists,
  useProducts,
  useResponsesForProducts,
} from '../lib/hooks';
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

const GROUPS: ReportDataSectionGroup[] = ['Report', 'Consumers', 'Food & science', 'Governance'];
const ALL_KEYS = new Set(REPORT_DATA_SECTION_DEFINITIONS.map(item => item.key));

export function ReportDataExportSheet({
  report,
  snapshot,
  decision,
  concept,
  instrumentalDataset,
  evidenceBundle,
  settings,
  projectId,
  initiallyOpen = false,
}: {
  report: CommercializationReportRecord;
  snapshot: CommercializationReportSnapshot;
  decision: DecisionRecord;
  concept: ConceptTest | null;
  instrumentalDataset?: InstrumentalDataset;
  evidenceBundle: EvidenceBundle | null;
  settings?: WorkspaceSettings;
  projectId?: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [selectedKeys, setSelectedKeys] = useState<Set<ReportDataSectionKey>>(() => new Set(ALL_KEYS));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const productsQuery = useProducts(open);
  const panelistsQuery = usePanelists(open);
  const formulationsQuery = useFormulationVersions(projectId, open);
  const conceptResponsesQuery = useConceptTestResponses(concept?.id, open);

  const reportProducts = useMemo(() => {
    const products = productsQuery.data ?? [];
    const exact = products.filter(product =>
      (decision.instrumentalSampleId && product.instrumentalSampleId === decision.instrumentalSampleId)
      || product.sourceSampleId === snapshot.product.sampleId,
    );
    if (exact.length > 0) return exact;
    return products.filter(product =>
      (!projectId || product.projectId === projectId)
      && product.name.trim().toLowerCase() === snapshot.product.sampleName.trim().toLowerCase(),
    );
  }, [decision.instrumentalSampleId, productsQuery.data, projectId, snapshot.product.sampleId, snapshot.product.sampleName]);

  const reportProductIds = useMemo(() => reportProducts.map(product => product.id), [reportProducts]);
  const foodResponsesQuery = useResponsesForProducts(reportProductIds, open);

  const sheets = useMemo(() => buildCommercializationDataSheets({
    report,
    snapshot,
    decision,
    concept,
    conceptResponses: conceptResponsesQuery.data ?? [],
    products: reportProducts,
    foodPanelResponses: foodResponsesQuery.data ?? [],
    panelists: panelistsQuery.data ?? [],
    instrumentalDataset,
    formulationVersions: formulationsQuery.data ?? [],
    evidenceBundle,
    organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
    workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
    anonymizePanelists: settings?.anonymizePanelistsInReports ?? true,
  }), [
    concept,
    conceptResponsesQuery.data,
    decision,
    evidenceBundle,
    foodResponsesQuery.data,
    formulationsQuery.data,
    instrumentalDataset,
    panelistsQuery.data,
    report,
    reportProducts,
    settings?.anonymizePanelistsInReports,
    settings?.organizationName,
    settings?.workspaceName,
    snapshot,
  ]);

  const sheetByKey = useMemo(() => new Map(sheets.map(item => [item.key, item])), [sheets]);
  const availableKeys = useMemo(() => new Set(sheets.filter(item => item.rows.length > 0).map(item => item.key)), [sheets]);
  const selectedSheets = useMemo(() => sheets.filter(item => selectedKeys.has(item.key) && item.rows.length > 0), [selectedKeys, sheets]);
  const selectedRowCount = selectedSheets.reduce((total, item) => total + item.rows.length, 0);
  const queries = [productsQuery, panelistsQuery, formulationsQuery, conceptResponsesQuery, foodResponsesQuery];
  const loading = queries.some(query => query.isLoading);
  const hasQueryError = queries.some(query => query.isError);

  const toggleSection = (key: ReportDataSectionKey, checked: boolean) => {
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
    if (exporting || loading || hasQueryError || selectedSheets.length === 0) return;
    setExporting(true);
    setError('');
    try {
      await downloadCommercializationDataWorkbook({
        sheets: selectedSheets,
        organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
        reportTitle: report.title || snapshot.product.sampleName,
      });
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the Excel workbook.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="size-4" />Export data</Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 border-l border-slate-200 bg-white sm:max-w-xl">
        <SheetHeader className="border-b border-slate-200 px-5 py-5 pr-12">
          <SheetTitle className="text-base text-slate-950">Export report data</SheetTitle>
          <SheetDescription className="max-w-md text-slate-600">
            Choose the datasets to include. Each selection becomes its own worksheet in one Excel workbook.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm">
          <p className="font-medium text-slate-700">
            {loading ? 'Loading linked data…' : `${availableKeys.size} datasets available`}
          </p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set(availableKeys))} disabled={loading}>Select all</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set())} disabled={loading}>Clear</Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {hasQueryError && (
            <div className="mt-4 flex items-start justify-between gap-4 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
              <p>Some linked report data could not be loaded. Retry before exporting so the workbook is complete.</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}><RefreshCw className="size-4" />Retry</Button>
            </div>
          )}

          <div className="mt-3 flex items-start gap-3 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-700">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <p>
              Names, email addresses, phone numbers, and postal addresses are never included. Participant codes follow the workspace report-privacy setting.
            </p>
          </div>

          {GROUPS.map(group => (
            <section key={group} className="pt-5" aria-labelledby={`export-group-${group.replace(/\W+/g, '-').toLowerCase()}`}>
              <h3 id={`export-group-${group.replace(/\W+/g, '-').toLowerCase()}`} className="mb-2 text-sm font-semibold text-slate-950">{group}</h3>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {REPORT_DATA_SECTION_DEFINITIONS.filter(item => item.group === group).map(definition => {
                  const rowCount = sheetByKey.get(definition.key)?.rows.length ?? 0;
                  const available = rowCount > 0;
                  const controlId = `export-${definition.key}`;
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
            <p className="text-xs text-slate-600" aria-live="polite">
              {selectedSheets.length} sheet{selectedSheets.length === 1 ? '' : 's'} · {selectedRowCount} data row{selectedRowCount === 1 ? '' : 's'}
            </p>
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
