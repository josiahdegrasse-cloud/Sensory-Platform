import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, LogOut, Lightbulb, ChevronDown, Settings, FileText, FolderKanban, Menu, BookOpenText } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../contexts/auth-context";
import { useFoodType } from "../contexts/food-type-context";
import { parseBatchSelection } from "../lib/project-identity";
import { useImportBatches, usePendingImports, useWorkspaceSettings } from "../lib/hooks";
import { currentPathToJourneyStep, legacyWorkflowPathToStep, projectPath } from "../lib/project-journey-routes";
import { ConsentGate } from "./consent-gate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { TenantOrNfiLogo } from "./nfi-brand";
import { ProjectSwitcher } from "./project-switcher";
import { applyBrandTheme } from "../lib/brand-theme";
import { NFI_BRAND_COLOR, NFI_BRAND_COLOR_DARK, NFI_ORGANIZATION_NAME } from "../lib/nfi-brand";

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { subCategory } = useFoodType();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: navImportBatches = [] } = useImportBatches(user?.role === 'admin');
  const shouldPollPendingImports = location.pathname === '/stage1'
    || currentPathToJourneyStep(location.pathname) === 'data';
  const { data: pendingImports = [] } = usePendingImports(
    user?.role === 'admin',
    { pollIntervalMs: shouldPollPendingImports ? 30_000 : false },
  );

  // Per-tenant branding (falls back to NFI when the org hasn't set its own).
  const brandLogo = workspaceSettings?.logoUrl ?? null;
  const brandName = workspaceSettings?.workspaceName ?? null;
  const isNfiWorkspace = user?.orgSlug === 'nfi'
    || workspaceSettings?.organizationName === NFI_ORGANIZATION_NAME;
  const brandPrimaryColor = isNfiWorkspace
    ? NFI_BRAND_COLOR
    : (workspaceSettings?.primaryColor ?? null);
  const brandAccentColor = isNfiWorkspace
    ? NFI_BRAND_COLOR_DARK
    : (workspaceSettings?.accentColor ?? null);

  // Drive the complete global tenant palette from the workspace record so
  // actions, focus states, navigation, and surfaces share one brand language.
  useEffect(() => {
    applyBrandTheme(document.documentElement.style, {
      primaryColor: brandPrimaryColor,
      accentColor: brandAccentColor,
    });
    return () => applyBrandTheme(document.documentElement.style);
  }, [brandPrimaryColor, brandAccentColor]);

  const activeAdminNavPath = (pathname: string) => {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    const projectStep = normalized.match(/^\/project\/[^/]+(?:\/([^/]+))?(?:\/[^/]+)?$/)?.[1] ?? null;

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
    { path: "/literature",      label: "Literature", icon: BookOpenText },
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
    <div className="tenant-brand-surface min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[var(--brand-border)] bg-white">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">

          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--brand-border)] py-3">
            <Link to={user?.role === 'panelist' ? '/panelist' : '/'} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
              <TenantOrNfiLogo
                logoUrl={brandLogo}
                organizationName={brandName}
                tenant={!isNfiWorkspace}
                markSize={36}
                monochromeMark
                textClassName="text-slate-700 [&_div]:text-[11px]"
              />
            </Link>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
              {user?.role === 'admin' && <ProjectSwitcher />}
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold text-slate-900">{user?.name}</div>
                <div className="text-xs text-slate-500">
                  {user?.role === 'panelist' ? `Panelist ${user?.panelistId ?? ''}` : 'Administrator'}
                </div>
              </div>
              {user?.role === 'admin' && (
                <Link
                  to="/settings"
                  title="Settings"
                  aria-label="Settings"
                  className="flex size-8 items-center justify-center rounded-md border border-[var(--brand-border)] text-slate-500 transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
                  style={{
                    background: isActive('/settings') ? 'var(--brand-soft)' : undefined,
                    color: isActive('/settings') ? 'var(--brand)' : undefined,
                  }}
                >
                  <Settings className="size-4" />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md border border-[var(--brand-border)] px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
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
                  <ChevronDown className="size-4 shrink-0 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
                <DropdownMenuLabel>Main navigation</DropdownMenuLabel>
                {navItems.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <DropdownMenuItem key={item.path} asChild className={active ? 'bg-slate-50 text-slate-900' : undefined}>
                      <Link
                        to={user?.role === 'admin' ? adminNavTarget(item.path) : item.path}
                        className="flex w-full items-center gap-2"
                      >
                        {Icon && <Icon className="size-4" />}
                        <span className="flex-1">{item.label}</span>
                        {item.path === '/stage1' && pendingImports.length > 0 && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-bold leading-none text-[var(--primary-foreground)]">
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

          <nav aria-label="Main navigation" className="hidden w-full items-stretch overflow-x-auto md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={user?.role === 'admin' ? adminNavTarget(item.path) : item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 min-w-24 flex-1 items-center justify-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]/20 ${active ? 'font-semibold' : 'font-normal text-slate-500 hover:bg-[var(--brand-canvas)] hover:text-slate-800'}`}
                  style={active ? { color: 'var(--brand)', borderBottomColor: 'var(--brand)' } : undefined}
                >
                  {Icon && <Icon className="size-4 shrink-0" />}
                  {item.label}
                  {item.path === '/stage1' && pendingImports.length > 0 && (
                    <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-bold leading-none text-[var(--primary-foreground)]">
                      {pendingImports.length > 9 ? '9+' : pendingImports.length}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] items-start px-4 py-6 sm:px-6 lg:py-8">
        <main className="flex-1 min-w-0">
          {user?.role === 'panelist' && (workspaceSettings?.requirePanelistConsent ?? true) && !user.consentAcceptedAt ? <ConsentGate /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
