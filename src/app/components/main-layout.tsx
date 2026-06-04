import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Lightbulb, Tag, Archive, Trash2, Undo2, Database } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect, useMemo, useState } from "react";
import { useFoodType } from "../contexts/food-type-context";
import { useImportBatches, useInstrumentalDataset, useProducts } from "../lib/hooks";
import { matchFoodType } from "../contexts/food-type-context";
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
  const { foodType, setSelection, extraFoodTypes, archivedFoodTypes, archiveFoodType, restoreFoodType, deleteFoodType } = useFoodType();
  const { data: products = [] } = useProducts();
  const { data: importBatches = [] } = useImportBatches();
  const { data: instrumentalDataset } = useInstrumentalDataset();
  const [pendingAction, setPendingAction] = useState<{ type: string; action: 'archive' | 'delete' } | null>(null);

  const productCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    products.filter(p => p.status !== 'archived').forEach(p => {
      const slug = matchFoodType(p.category);
      counts[slug] = (counts[slug] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  const builtInTypes = ['cheese', 'bread'];
  const allTypes = [...builtInTypes, ...extraFoodTypes.filter(t => !builtInTypes.includes(t))];
  const importedTypes = allTypes.filter(t => !builtInTypes.includes(t));
  const label = (ft: string) =>
    ft === 'cheese' ? 'Cheese' : ft === 'bread' ? 'Bread' : capitalize(ft);
  const activeTypeLabel = foodType === 'all' ? 'All Types' : label(foodType);
  const selectedSamples = useMemo(() => {
    const samples = instrumentalDataset?.eTongueData ?? [];
    if (foodType === 'all') return samples;
    return samples.filter(sample => sample.type === foodType);
  }, [foodType, instrumentalDataset]);
  const selectedSampleIds = useMemo(() => new Set(selectedSamples.map(sample => sample.sampleId)), [selectedSamples]);
  const selectedBatch = foodType === 'all'
    ? importBatches[0]
    : importBatches.find(batch => batch.foodTypeSlug === foodType);
  const selectedDataTypes = [
    selectedSamples.length > 0 ? 'E-tongue' : null,
    Object.keys(instrumentalDataset?.gcmsData ?? {}).some(sampleId => selectedSampleIds.has(sampleId)) ? 'GC-MS' : null,
    Object.keys(instrumentalDataset?.compositionData ?? {}).some(sampleId => selectedSampleIds.has(sampleId)) ? 'Composition' : null,
  ].filter(Boolean);

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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-100">
          <Tag className="size-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Food Type</span>
        </div>
        <div className="p-1.5 flex flex-col gap-0.5">
          <button
            onClick={() => setSelection('all', null)}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between"
            style={btnStyle(foodType === 'all')}
          >
            <span>All Types</span>
            {products.length > 0 && (
              <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                {products.filter(p => p.status !== 'archived').length}
              </span>
            )}
          </button>
          {allTypes.map(ft => {
            const imported = !builtInTypes.includes(ft);
            const active = foodType === ft;
            const count = productCountByType[ft];
            return (
              <div
                key={ft}
                className="group flex items-center rounded-lg transition-colors"
                style={btnStyle(active)}
              >
                <button
                  onClick={() => setSelection(ft, null)}
                  className="min-w-0 flex-1 text-left px-2.5 py-1.5 text-sm flex items-center justify-between"
                >
                  <span className="block truncate">{label(ft)}</span>
                  {count !== undefined && count > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium tabular-nums ml-1 shrink-0">{count}</span>
                  )}
                </button>
                {imported && (
                  <div className="flex items-center pr-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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
          {importedTypes.length === 0 && archivedFoodTypes.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-slate-400">
              Imported CSV types will appear here.
            </div>
          )}
        </div>
      </div>
      {foodType !== 'all' && (
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
              <div className="font-bold text-slate-900">{productCountByType[foodType] ?? 0}</div>
              <div className="text-slate-500">products</div>
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
                : `${label(pendingAction?.type ?? '')} and its imported machine data will be permanently removed. This cannot be undone.`}
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
    </aside>
  );
}

function FoodTypeBadge() {
  const { foodType, subCategory } = useFoodType();
  if (foodType === 'all') return null;
  const typeLabel = foodType === 'cheese' ? 'Cheese' : foodType === 'bread' ? 'Bread' : capitalize(foodType);
  const label = subCategory ?? typeLabel;
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

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const getAdminNavItems = () => [
    { path: "/stage1",         label: "Machine Testing",    icon: FlaskConical },
    { path: "/survey-analysis", label: "Analyze Results",   icon: BarChart3 },
    { path: "/decision",        label: "Final Decision",    icon: GitMerge },
    { path: "/concept-testing", label: "Concept Testing",   icon: Lightbulb },
    { path: "/admin",           label: "Configure Products", icon: Settings },
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
              <NfiLogoMark size={36} />
              <div style={{ lineHeight: '1.22' }}>
                <div className="text-[11px] text-slate-700">new</div>
                <div className="text-[11px] text-slate-700">food</div>
                <div className="text-[11px] text-slate-700">innovation</div>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              {user?.role === 'admin' && <FoodTypeBadge />}
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{user?.name}</div>
                <div className="text-xs text-slate-400">
                  {user?.role === 'panelist' ? `Panelist ${user?.panelistId ?? ''}` : 'Administrator'}
                </div>
              </div>
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
                    borderBottomColor: active ? NFI_BLUE : 'transparent',
                    color: active ? NFI_BLUE : '#64748b',
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
