import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, LogOut, Lightbulb, Archive, Trash2, Undo2, ChevronDown, ChevronRight, Settings, AlertCircle, AlertTriangle, X, FileText, FolderKanban, Menu } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect, useMemo, useState } from "react";
import { useFoodType } from "../contexts/food-type-context";
import { parseBatchSelection, encodeBatchSelection } from "../lib/project-identity";
import { useDeleteImportBatch, useImportBatches, usePendingImports, useUpdateImportBatchStatus, useWorkspaceSettings } from "../lib/hooks";
import { useProjectStatus } from "../lib/use-project-status";
import { currentPathToJourneyStep, legacyWorkflowPathToStep, projectPath } from "../lib/project-journey-routes";
import type { ImportBatchRecord } from "../lib/database";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { NFI_BRAND_COLOR } from "../lib/nfi-brand";
import { TenantOrNfiLogo } from "./nfi-brand";

const LEGACY_DEMO_IMPORT_CUTOFF = Date.parse('2026-06-16T03:35:41Z');

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isLegacyDemoImportCandidate(batch: ImportBatchRecord) {
  const createdAt = Date.parse(batch.createdAt);
  return ['bread', 'cheese'].includes(batch.foodTypeSlug)
    && Number.isFinite(createdAt)
    && createdAt <= LEGACY_DEMO_IMPORT_CUTOFF;
}

function AdminCleanupReview({ batches }: { batches: ImportBatchRecord[] }) {
  const deleteImportBatch = useDeleteImportBatch();
  const [pendingCleanup, setPendingCleanup] = useState<ImportBatchRecord | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const candidates = batches.filter(isLegacyDemoImportCandidate);
  const canConfirm = confirmationText.trim().toUpperCase() === 'DELETE';

  if (candidates.length === 0) return null;

  return (
    <>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-900">Cleanup review</p>
            <p className="mt-1 text-[11px] leading-snug text-amber-800">
              {candidates.length} old bread/cheese import{candidates.length === 1 ? '' : 's'} may be legacy demo data. Nothing is deleted automatically.
            </p>
            <div className="mt-2 space-y-1">
              {candidates.slice(0, 4).map(batch => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => {
                    setPendingCleanup(batch);
                    setConfirmationText('');
                  }}
                  className="block w-full rounded-md border border-amber-200 bg-white/80 px-2 py-1.5 text-left text-[11px] text-amber-950 transition-colors hover:bg-white"
                >
                  <span className="block truncate font-semibold">{batch.projectName ?? batch.fileName}</span>
                  <span className="block text-amber-700">{batch.foodTypeLabel} · {new Date(batch.createdAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingCleanup} onOpenChange={open => {
        if (!open) {
          setPendingCleanup(null);
          setConfirmationText('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete legacy import permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {pendingCleanup?.projectName ?? pendingCleanup?.fileName ?? 'this import'} and linked samples/surveys. This is no longer an automatic cleanup; only continue if you have confirmed it is disposable demo data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Type DELETE to confirm
            <input
              value={confirmationText}
              onChange={event => setConfirmationText(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              autoComplete="off"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50"
              disabled={!pendingCleanup || !canConfirm || deleteImportBatch.isPending}
              onClick={() => {
                if (!pendingCleanup || !canConfirm) return;
                deleteImportBatch.mutate(pendingCleanup.id, {
                  onSuccess: () => {
                    setPendingCleanup(null);
                    setConfirmationText('');
                  },
                });
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CategorySidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { foodType, subCategory, setSelection, extraFoodTypes, archivedFoodTypes, deletedFoodTypes, archiveFoodType, restoreFoodType, deleteFoodType, actionError, clearActionError } = useFoodType();
  const { data: importBatches = [] } = useImportBatches();
  const updateImportBatchStatus = useUpdateImportBatchStatus();
  const [pendingAction, setPendingAction] = useState<{ type: string; action: 'archive' | 'delete' } | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState<{ id: string; label: string; action: 'archive' | 'delete' } | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const allTypes = extraFoodTypes
    .filter(type => !archivedFoodTypes.includes(type) && !deletedFoodTypes.includes(type));
  const label = (ft: string) =>
    ft === 'cheese' ? 'Cheese' : ft === 'bread' ? 'Bread' : capitalize(ft);
  const selectedBatchId = parseBatchSelection(subCategory);
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
  const status = useProjectStatus(foodType, selectedBatchId);
  const hasActiveProject = foodType !== 'all' && Boolean(foodType);
  const applyTypeProjectStatus = (type: string, nextStatus: 'archived' | 'deleted') => {
    (projectBatchesByType[type] ?? []).forEach(project => {
      updateImportBatchStatus.mutate({ id: project.id, status: nextStatus });
    });
  };
  const navigateToProjectSelection = (project: ImportBatchRecord | null) => {
    if (!project) return;
    const projectId = project.projectId ?? project.id;
    const step = currentPathToJourneyStep(location.pathname) ?? 'overview';
    navigate(projectPath(projectId, step, location.search));
  };
  const selectType = (ft: string, project: ImportBatchRecord | null = null) => {
    setSelection(ft, project ? encodeBatchSelection(project.id) : null);
    navigateToProjectSelection(project);
  };

  const btnStyle = (active: boolean) => ({
    background: active ? '#f1f5f9' : 'transparent',
    color: active ? 'var(--brand)' : '#64748b',
    fontWeight: active ? 600 : 400,
  });

  return (
    <aside
      className="hidden w-52 shrink-0 self-start sticky top-[89px] xl:block"
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
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-100">
          <FolderKanban className="size-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Project Ledger</span>
        </div>
        <div className="p-1.5 flex flex-col gap-0.5">
          {allTypes.map(ft => {
            const active = foodType === ft;
            const projects = projectBatchesByType[ft] ?? [];
            const singleProject = projects.length === 1 ? projects[0] : null;
            const hasMultipleProjects = projects.length > 1;
            const expanded = expandedTypes[ft] ?? active;
            return (
              <div key={ft}>
                <div
                  className="group flex items-center rounded-md transition-colors"
                  style={btnStyle(active)}
                >
                  {hasMultipleProjects && (
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
                    onClick={() => selectType(ft, singleProject)}
                    title={singleProject?.fileName}
                    className={`min-w-0 flex-1 text-left py-1.5 text-sm ${hasMultipleProjects ? 'px-1' : 'px-2.5'}`}
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
                {hasMultipleProjects && expanded && (() => {
                  // A batch with a real project shows its project name; a legacy/
                  // unassigned batch is still shown, just clearly not called a
                  // "project". Assigned rows are grouped above unassigned ones.
                  const assigned = projects.filter(project => project.projectId);
                  const unassigned = projects.filter(project => !project.projectId);
                  const renderRow = (project: typeof projects[number]) => {
                    const fallbackName = project.fileName.replace(/\.csv$/i, '');
                    const displayName = project.projectName ?? `Unassigned: ${fallbackName}`;
                    return (
                      <div
                        key={project.id}
                        className={`group/project flex items-center gap-1 rounded-md ${selectedBatchId === project.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <button
                          type="button"
                          onClick={() => selectType(ft, project)}
                          title={project.projectName ?? project.fileName}
                          className={`min-w-0 flex-1 truncate px-2 py-1 text-left text-xs ${selectedBatchId === project.id ? 'font-semibold text-slate-800' : `${project.projectId ? 'text-slate-500' : 'text-slate-400 italic'} group-hover/project:text-slate-800`}`}
                        >
                          {displayName}
                        </button>
                        <button
                          type="button"
                          title={`Archive ${displayName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingProjectAction({ id: project.id, label: displayName, action: 'archive' });
                          }}
                          className="p-1 text-slate-300 hover:text-amber-700"
                        >
                          <Archive className="size-3" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${displayName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingProjectAction({ id: project.id, label: displayName, action: 'delete' });
                          }}
                          className="p-1 pr-1.5 text-slate-300 hover:text-rose-700"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    );
                  };
                  return (
                    <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
                      {assigned.map(renderRow)}
                      {assigned.length > 0 && unassigned.length > 0 && (
                        <div className="mt-1 border-t border-slate-100 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Unassigned batches
                        </div>
                      )}
                      {unassigned.map(renderRow)}
                    </div>
                  );
                })()}
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
              Import CSV data to create the first project.
            </div>
          )}
        </div>
      </div>
      {hasActiveProject && status.warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
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
      <AdminCleanupReview batches={importBatches} />
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
                if (pendingAction.action === 'archive') {
                  archiveFoodType(pendingAction.type);
                  applyTypeProjectStatus(pendingAction.type, 'archived');
                } else {
                  deleteFoodType(pendingAction.type);
                  applyTypeProjectStatus(pendingAction.type, 'deleted');
                }
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
  const batchId = parseBatchSelection(subCategory);
  const batch = batchId ? importBatches.find(item => item.id === batchId) : null;
  const label = batch ? batch.fileName.replace(/\.csv$/i, '') : (subCategory ?? typeLabel);
  return (
    <span className="inline-flex max-w-[9rem] truncate rounded-full border px-2.5 py-1 text-xs font-semibold sm:max-w-[13rem]" style={{ background: '#f1f5f9', color: 'var(--brand)', borderColor: '#cbd5e1' }}>
      {label}
    </span>
  );
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { subCategory } = useFoodType();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: navImportBatches = [] } = useImportBatches(user?.role === 'admin');
  const { data: pendingImports = [] } = usePendingImports(user?.role === 'admin');

  // Per-tenant branding (falls back to NFI when the org hasn't set its own).
  const brandLogo = workspaceSettings?.logoUrl ?? null;
  const brandName = workspaceSettings?.workspaceName ?? null;

  // Drive the global --brand accent from the org's colour so every var(--brand)
  // usage across the app themes per tenant from one place.
  useEffect(() => {
    document.documentElement.style.setProperty('--brand', workspaceSettings?.primaryColor || NFI_BRAND_COLOR);
  }, [workspaceSettings?.primaryColor]);

  const activeAdminNavPath = (pathname: string) => {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    const projectStep = normalized.match(/^\/project\/[^/]+(?:\/([^/]+))?$/)?.[1] ?? null;

    if (projectStep) {
      switch (projectStep) {
        case 'data':
          return '/stage1';
        case 'studies':
          return '/admin';
        case 'responses':
          return '/admin';
        case 'insights':
          return '/survey-analysis';
        case 'decision':
          return '/decision';
        case 'concept':
          return '/concept-testing';
        case 'report':
          return '/reports';
        default:
          return '/project';
      }
    }

    if (normalized === '/' || normalized === '/project') return '/';
    if (/^\/project\/[^/]+$/.test(normalized)) return '/';
    if (normalized === '/report' || normalized === '/commercialization-report') return '/reports';
    return normalized;
  };

  const isActive = (path: string) => {
    if (user?.role === 'admin') return activeAdminNavPath(location.pathname) === path;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const getPanelistNavItems = () => [
    { path: "/panelist", label: "My Questionnaires", icon: ClipboardList },
  ];

  const selectedNavBatchId = parseBatchSelection(subCategory);
  const selectedNavBatch = selectedNavBatchId
    ? navImportBatches.find(batch => batch.id === selectedNavBatchId)
    : null;
  const selectedProjectId = selectedNavBatch?.projectId ?? selectedNavBatch?.id ?? null;
  const getAdminNavItems = () => [
    { path: "/",               label: "Overview",  icon: FolderKanban },
    { path: "/stage1",         label: "Data",      icon: FlaskConical },
    { path: "/admin",          label: "Studies",   icon: ClipboardList },
    { path: "/survey-analysis", label: "Insights", icon: BarChart3 },
    { path: "/decision",       label: "Decision",  icon: GitMerge },
    { path: "/concept-testing", label: "Concept",  icon: Lightbulb },
    { path: "/reports",        label: "Report",    icon: FileText },
  ];
  const navItems = user?.role === 'admin' ? getAdminNavItems() : getPanelistNavItems();
  const activeNavItem = navItems.find(item => isActive(item.path)) ?? navItems[0];
  const ActiveNavIcon = activeNavItem?.icon;
  const adminNavTarget = (path: string) => {
    if (!selectedProjectId) return path;
    if (path === '/') return '/';
    const step = legacyWorkflowPathToStep(path);
    return step ? projectPath(selectedProjectId, step) : path;
  };

  useEffect(() => {
    if (user?.role === 'panelist' && location.pathname === '/') navigate('/panelist');
  }, [user, location.pathname, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">

          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3">
            <Link to={user?.role === 'panelist' ? '/panelist' : '/'} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
              <TenantOrNfiLogo
                logoUrl={brandLogo}
                organizationName={brandName}
                markSize={36}
                monochromeMark
                textClassName="text-slate-700 [&_div]:text-[11px]"
              />
            </Link>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
              {user?.role === 'admin' && <FoodTypeBadge />}
              <div className="hidden text-right sm:block">
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
                    color: isActive('/settings') ? 'var(--brand)' : undefined,
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
          <div className="flex items-center justify-between gap-3 py-2 md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  aria-label="Open main navigation"
                >
                  <Menu className="size-4 shrink-0" />
                  {ActiveNavIcon && <ActiveNavIcon className="size-4 shrink-0 text-slate-500" />}
                  <span className="truncate">{activeNavItem?.label ?? 'Menu'}</span>
                  <ChevronDown className="size-4 shrink-0 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
                <DropdownMenuLabel>Main navigation</DropdownMenuLabel>
                {navItems.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <DropdownMenuItem key={item.path} asChild className={active ? 'bg-slate-100 text-slate-950' : undefined}>
                      <Link
                        to={user?.role === 'admin' ? adminNavTarget(item.path) : item.path}
                        className="flex w-full items-center gap-2"
                      >
                        {Icon && <Icon className="size-4" />}
                        <span className="flex-1">{item.label}</span>
                        {item.path === '/stage1' && pendingImports.length > 0 && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
                            {pendingImports.length > 9 ? '9+' : pendingImports.length}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden items-center overflow-x-auto md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={user?.role === 'admin' ? adminNavTarget(item.path) : item.path}
                  className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors sm:px-4"
                  style={{
                    borderBottomColor: active ? 'var(--brand)' : 'transparent',
                    color: active ? 'var(--brand)' : '#64748b',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#1e293b'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {item.label}
                  {item.path === '/stage1' && pendingImports.length > 0 && (
                    <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
                      {pendingImports.length > 9 ? '9+' : pendingImports.length}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] items-start gap-6 px-4 py-6 sm:px-6 lg:py-8">
        {user?.role === 'admin' && <CategorySidebar />}
        <main className="flex-1 min-w-0">
          {user?.role === 'panelist' && (workspaceSettings?.requirePanelistConsent ?? true) && !user.consentAcceptedAt ? <ConsentGate /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
