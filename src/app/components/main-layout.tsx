import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Lightbulb, ChevronRight, Check } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect, useState } from "react";

const NFI_BLUE = '#6B7890';

const RD_WORKFLOW_PATHS = ['/stage1', '/survey-analysis', '/decision'];
const RD_WORKFLOW_STEPS = [
  { path: '/stage1',          label: 'Machine Testing' },
  { path: '/survey-analysis', label: 'Analyze Results' },
  { path: '/decision',        label: 'Final Decision' },
];

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

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [visitedWorkflowPaths, setVisitedWorkflowPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const matched = RD_WORKFLOW_STEPS.find(s => location.pathname.startsWith(s.path));
    if (matched) {
      setVisitedWorkflowPaths(prev => {
        if (prev.has(matched.path)) return prev;
        const next = new Set(prev);
        next.add(matched.path);
        return next;
      });
    }
  }, [location.pathname]);

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

      {/* R&D Workflow Rail */}
      {user?.role === 'admin' && RD_WORKFLOW_PATHS.some(p => location.pathname.startsWith(p)) && (
        <div className="bg-slate-50 border-b border-slate-100">
          <div className="max-w-[1600px] mx-auto px-6 py-2 flex items-center gap-1 text-xs">
            <span className="text-slate-400 mr-1">R&amp;D Workflow:</span>
            {RD_WORKFLOW_STEPS.map((step, i) => {
              const active = location.pathname.startsWith(step.path);
              const visited = !active && visitedWorkflowPaths.has(step.path);
              return (
                <span key={step.path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3 text-slate-300" />}
                  <Link
                    to={step.path}
                    className="px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                    style={{
                      color: active ? NFI_BLUE : visited ? '#475569' : '#94a3b8',
                      fontWeight: active ? 600 : visited ? 500 : 400,
                      background: active ? '#f1f5f9' : 'transparent',
                    }}
                  >
                    {visited && <Check className="size-2.5" style={{ color: '#10b981' }} />}
                    {step.label}
                  </Link>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
