import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, LogOut, Lightbulb, Tag, Archive, Trash2, Undo2, Database, ChevronDown, ChevronRight, Settings, AlertCircle, AlertTriangle, X } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect, useMemo, useState } from "react";
import { useFoodType } from "../contexts/food-type-context";
import { useImportBatches, useInstrumentalDataset, useProducts, useUpdateImportBatchStatus, useWorkspaceSettings } from "../lib/hooks";
import { matchFoodType } from "../contexts/food-type-context";
import { useProjectStatus } from "../lib/use-project-status";
import { ConsentGate } from "./consent-gate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

const NFI_BLUE = '#6B7890';

function NfiLogoMark({ size = 36 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '26%', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
      <img
        src="/new_foodinnovation_ltd_logo.jpg"
        alt="NFI"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(10)', transform: 'scale(1.18)' }}
      />
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CategorySidebar() {
  const { foodType, subCategory, setSelection, extraFoodTypes, archivedFoodTypes, deletedFoodTypes, archiveFoodType, restoreFoodType, deleteFoodType, actionError, clearActionError } = useFoodType();
  const { data: products = [] } = useProducts();
  const { data: importBatches = [] } = useImportBatches();
  const { data: instrumentalDataset } = useInstrumentalDataset();
  const updateImportBatchStatus = useUpdateImportBatchStatus();
  const [pendingAction, setPendingAction] = useState<{ type: string; action: 'archive' | 'delete' } | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState<{ id: string; label: string; action: 'archive' | 'delete' } | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const allTypes = extraFoodTypes
    .filter(type => !archivedFoodTypes.includes(type) && !deletedFoodTypes.includes(type));
  const label = (ft: string) =>
    ft === 'cheese' ? 'Cheese' : ft === 'bread' ? 'Bread' : capitalize(ft);
  const activeTypeLabel = label(foodType);
  const selectedBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const selectedSamples = useMemo(() => {
    const samples = instrumentalDataset?.eTongueData ?? [];
    return samples.filter(sample =>
      sample.type === foodType &&
      (!selectedBatchId || sample.importBatchId === selectedBatchId)
    );
  }, [foodType, instrumentalDataset, selectedBatchId]);
  const selectedSampleIds = useMemo(() => new Set(selectedSamples.map(sample => sample.sampleId)), [selectedSamples]);
  const selectedBatch = selectedBatchId
    ? importBatches.find(batch => batch.id === selectedBatchId)
    : importBatches.find(batch => batch.foodTypeSlug === foodType);
  const projectBatchesByType = useMemo(() => {
    const groups: Record<string, typeof importBatches> = {};
    importBatches
      .filter(batch => batch.status === 'active')
      .forEach(batch => {
        if (!groups[batch.foodTypeSlug]) groups[batch.foodTypeSlug] = [];
        groups[batch.foodTypeSlug].push(batch);
      });
    return groups;
  }, [importBatches]);
  const selectedDataTypes = [
    selectedSamples.length > 0 ? 'E-tongue' : null,
    Object.keys(instrumentalDataset?.gcmsData ?? {}).some(sampleId => selectedSampleIds.has(sampleId)) ? 'GC-MS' : null,
    Object.keys(instrumentalDataset?.compositionData ?? {}).some(sampleId => selectedSampleIds.has(sampleId)) ? 'Composition' : null,
  ].filter(Boolean);
  const activeSurveyCount = products.filter(product =>
    product.status !== 'archived' &&
    matchFoodType(product.category) === foodType &&
    (!selectedBatchId || product.sourceImportBatchId === selectedBatchId)
  ).length;
  const status = useProjectStatus(foodType, selectedBatchId);
  const hasActiveProject = foodType !== 'all' && Boolean(foodType);

  const btnStyle = (active: boolean) => ({
    background: active ? '#f1f5f9' : 'transparent',
    color: active ? NFI_BLUE : '#64748b',
    fontWeight: active ? 600 : 400,
  });

  return (
    <aside
      className="w-48 shrink-0 self-start sticky top-[89px]"
      style={{ minHeight: 'calc(100vh - 89px)' }}
    >
      {actionError && (
        <div className="mb-3 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{actionError}</span>
          <button type="button" onClick={clearActionError} title="Dismiss error" className="shrink-0 text-rose-600 hover:text-rose-900">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-100">
          <Tag className="size-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Food Type</span>
        </div>
        <div className="p-1.5 flex flex-col gap-0.5">
          {allTypes.map(ft => {
            const active = foodType === ft;
            const projects = projectBatchesByType[ft] ?? [];
            const hasProjects = projects.length > 0;
            const expanded = expandedTypes[ft] ?? active;
            return (
              <div key={ft}>
                <div
                  className="group flex items-center rounded-lg transition-colors"
                  style={btnStyle(active)}
                >
                  {hasProjects && (
                    <button
                      type="button"
                      title={`${expanded ? 'Collapse' : 'Expand'} ${label(ft)} projects`}
                      onClick={() => setExpandedTypes(prev => ({ ...prev, [ft]: !expanded }))}
                      className="ml-1 p-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => setSelection(ft, null)}
                    className={`min-w-0 flex-1 text-left py-1.5 text-sm ${hasProjects ? 'px-1' : 'px-2.5'}`}
                  >
                    <span className="block truncate">{label(ft)}</span>
                  </button>
                  <div className="flex items-center pr-1 opacity-100 transition-opacity">
                    <button
                      type="button"
                      title={`Archive ${label(ft)}`}
                      onClick={() => setPendingAction({ type: ft, action: 'archive' })}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      <Archive className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title={`Delete ${label(ft)}`}
                      onClick={() => setPendingAction({ type: ft, action: 'delete' })}
                      className="p-1 text-slate-400 hover:text-rose-700 rounded"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                {hasProjects && expanded && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
                    {projects.map((project, index) => (
                      <div
                        key={project.id}
                        className={`group/project flex items-center gap-1 rounded-md ${selectedBatchId === project.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelection(ft, `batch:${project.id}`)}
                          title={project.fileName}
                          className={`min-w-0 flex-1 truncate px-2 py-1 text-left text-xs ${selectedBatchId === project.id ? 'font-semibold text-slate-800' : 'text-slate-500 group-hover/project:text-slate-800'}`}
                        >
                          Project {index + 1}: {project.fileName.replace(/\.csv$/i, '')}
                        </button>
                        <button
                          type="button"
                          title={`Archive ${project.fileName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingProjectAction({ id: project.id, label: project.fileName.replace(/\.csv$/i, ''), action: 'archive' });
                          }}
                          className="p-1 text-slate-300 hover:text-amber-700"
                        >
                          <Archive className="size-3" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${project.fileName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingProjectAction({ id: project.id, label: project.fileName.replace(/\.csv$/i, ''), action: 'delete' });
                          }}
                          className="p-1 pr-1.5 text-slate-300 hover:text-rose-700"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {archivedFoodTypes.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="px-2.5 pb-1 text-[11px] font-semibold text-slate-400">Archived</div>
              {archivedFoodTypes.map(ft => (
                <div key={ft} className="group flex items-center rounded-lg text-slate-400 hover:bg-slate-50">
                  <button
                    onClick={() => restoreFoodType(ft)}
                    className="min-w-0 flex-1 text-left px-2.5 py-1.5 text-sm"
                  >
                    <span className="block truncate">{label(ft)}</span>
                  </button>
                  <div className="flex items-center pr-1">
                    <button
                      type="button"
                      title={`Restore ${label(ft)}`}
                      onClick={() => restoreFoodType(ft)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title={`Delete ${label(ft)}`}
                      onClick={() => setPendingAction({ type: ft, action: 'delete' })}
                      className="p-1 text-slate-400 hover:text-rose-700 rounded"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {allTypes.length === 0 && archivedFoodTypes.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-slate-400">
              Upload a CSV to create a food type.
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Database className="size-3.5 text-slate-400" />
          {activeTypeLabel}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
            <div className="font-bold text-slate-900">{selectedSamples.length}</div>
            <div className="text-slate-500">machine samples</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
            <div className="font-bold text-slate-900">{activeSurveyCount}</div>
            <div className="text-slate-500">surveys</div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          {selectedBatch
            ? `Last import: ${new Date(selectedBatch.createdAt).toLocaleDateString()}`
            : 'No saved import batches yet.'}
        </div>
        {selectedDataTypes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedDataTypes.map(kind => (
              <span key={kind} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {kind}
              </span>
            ))}
          </div>
        )}
      </div>
      {hasActiveProject && status.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="size-3.5" />
              Warnings
            </div>
            {status.warnings.map(warning => (
              <div key={warning} className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}
      <AlertDialog open={!!pendingAction} onOpenChange={open => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === 'archive' ? 'Archive food type?' : 'Delete food type?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === 'archive'
                ? `${label(pendingAction.type)} will be hidden from the active food type list. You can restore it from the archived section.`
                : `${label(pendingAction?.type ?? '')} will be removed from active food lists and charts. Linked surveys are deleted; machine records remain soft-deleted for audit recovery.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pendingAction?.action === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : ''}
              onClick={() => {
                if (!pendingAction) return;
                if (pendingAction.action === 'archive') archiveFoodType(pendingAction.type);
                else deleteFoodType(pendingAction.type);
                setPendingAction(null);
              }}
            >
              {pendingAction?.action === 'archive' ? 'Archive type' : 'Delete type'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!pendingProjectAction} onOpenChange={open => !open && setPendingProjectAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingProjectAction?.action === 'archive' ? 'Archive project?' : 'Delete project?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingProjectAction?.action === 'archive'
                ? `${pendingProjectAction.label} will be hidden from the active project list. Linked surveys will be archived.`
                : `${pendingProjectAction?.label ?? 'This project'} and its linked surveys will be deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pendingProjectAction?.action === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : ''}
              disabled={updateImportBatchStatus.isPending}
              onClick={() => {
                if (!pendingProjectAction) return;
                updateImportBatchStatus.mutate({
                  id: pendingProjectAction.id,
                  status: pendingProjectAction.action === 'archive' ? 'archived' : 'deleted',
                });
                if (selectedBatchId === pendingProjectAction.id) setSelection(foodType, null);
                setPendingProjectAction(null);
              }}
            >
              {pendingProjectAction?.action === 'archive' ? 'Archive project' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function FoodTypeBadge() {
  const { foodType, subCategory } = useFoodType();
  const { data: importBatches = [] } = useImportBatches();
  const typeLabel = foodType === 'cheese' ? 'Cheese' : foodType === 'bread' ? 'Bread' : capitalize(foodType);
  const batchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const batch = batchId ? importBatches.find(item => item.id === batchId) : null;
  const label = batch ? batch.fileName.replace(/\.csv$/i, '') : (subCategory ?? typeLabel);
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ background: '#f1f5f9', color: NFI_BLUE, borderColor: '#cbd5e1' }}>
      {label}
    </span>
  );
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: workspaceSettings } = useWorkspaceSettings();

  // Per-tenant branding (falls back to NFI when the org hasn't set its own).
  const brandColor = workspaceSettings?.primaryColor || NFI_BLUE;
  const brandLogo = workspaceSettings?.logoUrl ?? null;
  const brandName = workspaceSettings?.workspaceName ?? null;

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const getAdminNavItems = () => [
    { path: "/stage1",         label: "Instruments",        icon: FlaskConical },
    { path: "/admin",           label: "Configure",          icon: ClipboardList },
    { path: "/survey-analysis", label: "Analyze Results",   icon: BarChart3 },
    { path: "/decision",        label: "Final Decision",    icon: GitMerge },
    { path: "/concept-testing", label: "Concept Testing",   icon: Lightbulb },
  ];

  const getPanelistNavItems = () => [
    { path: "/panelist", label: "My Questionnaires", icon: ClipboardList },
  ];

  const navItems = user?.role === 'admin' ? getAdminNavItems() : getPanelistNavItems();

  useEffect(() => {
    if (user?.role === 'panelist' && location.pathname === '/') navigate('/panelist');
  }, [user, location.pathname, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6">

          {/* Top bar */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName ?? 'Logo'}
                  style={{ height: 36, width: 'auto', maxWidth: 160, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <>
                  <NfiLogoMark size={36} />
                  <div style={{ lineHeight: '1.22' }}>
                    <div className="text-[11px] text-slate-700">new</div>
                    <div className="text-[11px] text-slate-700">food</div>
                    <div className="text-[11px] text-slate-700">innovation</div>
                  </div>
                </>
              )}
            </Link>

            <div className="flex items-center gap-4">
              {user?.role === 'admin' && <FoodTypeBadge />}
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{user?.name}</div>
                <div className="text-xs text-slate-400">
                  {user?.role === 'panelist' ? `Panelist ${user?.panelistId ?? ''}` : 'Administrator'}
                </div>
              </div>
              {user?.role === 'admin' && (
                <Link
                  to="/settings"
                  title="Settings"
                  aria-label="Settings"
                  className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  style={{
                    background: isActive('/settings') ? '#f1f5f9' : undefined,
                    color: isActive('/settings') ? brandColor : undefined,
                  }}
                >
                  <Settings className="size-4" />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors border border-slate-200"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>

          {/* Nav row */}
          <div className="flex items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-1.5 px-4 py-3 text-sm transition-colors border-b-2"
                  style={{
                    borderBottomColor: active ? brandColor : 'transparent',
                    color: active ? brandColor : '#64748b',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#1e293b'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {item.label}
                </Link>
              );
            })}
          </div>

        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-8 flex gap-6 items-start">
        {user?.role === 'admin' && <CategorySidebar />}
        <main className="flex-1 min-w-0">
          {user?.role === 'panelist' && (workspaceSettings?.requirePanelistConsent ?? true) && !user.consentAcceptedAt ? <ConsentGate /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
