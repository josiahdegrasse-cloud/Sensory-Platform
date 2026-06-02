import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Lightbulb } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect } from "react";

const NFI_DARK = '#111111';

function NfiLogoMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-xl flex-shrink-0"
      style={{ width: size, height: size, background: NFI_DARK }}
    >
      {/* Two leaves — upper right inside the mark */}
      <svg
        className="absolute"
        style={{ top: 4, right: 5 }}
        width="12"
        height="9"
        viewBox="0 0 12 9"
        fill="none"
      >
        <path d="M2.5 8.5C2.5 5.5 1 3.5 0 2.5C1 0.8 3.8 1.2 4.2 4.5" fill="#8899aa"/>
        <path d="M9.5 8.5C9.5 5.5 11 3.5 12 2.5C11 0.8 8.2 1.2 7.8 4.5" fill="#8899aa"/>
      </svg>
      <span
        className="text-white font-bold select-none"
        style={{ fontSize: size * 0.36, letterSpacing: '-0.02em' }}
      >
        ñfi
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
    { path: "/stage1", label: "Machine Testing", icon: FlaskConical },
    { path: "/survey-analysis", label: "Analyse Results", icon: BarChart3 },
    { path: "/decision", label: "Final Decision", icon: GitMerge },
    { path: "/concept-testing", label: "Concept Testing", icon: Lightbulb },
    { path: "/admin", label: "Configure", icon: Settings },
  ];

  const getPanelistNavItems = () => [
    { path: "/panelist", label: "My Questionnaires", icon: ClipboardList },
  ];

  const navItems = user?.role === 'admin' ? getAdminNavItems() : getPanelistNavItems();

  useEffect(() => {
    if (user?.role === 'panelist' && location.pathname === '/') {
      navigate('/panelist');
    }
    if (user?.role === 'admin' && location.pathname === '/') {
      navigate('/stage1');
    }
  }, [user, location.pathname, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6">

          {/* Top bar: logo + user */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
              <NfiLogoMark size={36} />
              <div className="leading-none" style={{ lineHeight: '1.25' }}>
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
                    borderBottomColor: active ? NFI_DARK : 'transparent',
                    color: active ? NFI_DARK : '#64748b',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = NFI_DARK;
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = '#64748b';
                  }}
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
