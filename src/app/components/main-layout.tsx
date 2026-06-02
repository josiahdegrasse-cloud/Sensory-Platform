import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Lightbulb } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect } from "react";

// NFI brand blue-gray — the exact colour of their logo background
const NFI_BLUE = '#6B7890';

function NfiLogoMark({ size = 36, onDark = false }: { size?: number; onDark?: boolean }) {
  const leafW = Math.round(size * 0.31);
  const leafH = Math.round(size * 0.29);

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: onDark ? 'rgba(255,255,255,0.15)' : '#111111',
        borderRadius: '22%',
        border: onDark ? '1px solid rgba(255,255,255,0.22)' : 'none',
      }}
    >
      {/* Two-leaf sprout above the "n" */}
      <svg
        style={{
          position: 'absolute',
          top: Math.round(size * 0.09),
          left: Math.round(size * 0.12),
          width: leafW,
          height: leafH,
          overflow: 'visible',
        }}
        viewBox="0 0 10 9"
        fill="none"
      >
        <ellipse cx="3.0" cy="5.8" rx="1.7" ry="4.0" transform="rotate(-22 3.0 5.8)" fill="white"/>
        <ellipse cx="7.0" cy="5.8" rx="1.7" ry="4.0" transform="rotate(22 7.0 5.8)"  fill="white"/>
      </svg>
      <span
        className="font-bold select-none"
        style={{
          color: 'white',
          fontSize: Math.round(size * 0.35),
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        nfi
      </span>
    </div>
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
    { path: "/stage1",         label: "Machine Testing",  icon: FlaskConical },
    { path: "/survey-analysis", label: "Analyse Results",  icon: BarChart3 },
    { path: "/decision",        label: "Final Decision",   icon: GitMerge },
    { path: "/concept-testing", label: "Concept Testing",  icon: Lightbulb },
    { path: "/admin",           label: "Configure",        icon: Settings },
  ];

  const getPanelistNavItems = () => [
    { path: "/panelist", label: "My Questionnaires", icon: ClipboardList },
  ];

  const navItems = user?.role === 'admin' ? getAdminNavItems() : getPanelistNavItems();

  useEffect(() => {
    if (user?.role === 'panelist' && location.pathname === '/') navigate('/panelist');
    if (user?.role === 'admin'    && location.pathname === '/') navigate('/stage1');
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

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
