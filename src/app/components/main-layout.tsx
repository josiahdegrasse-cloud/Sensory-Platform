import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Lightbulb } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect } from "react";

const NFI_ORANGE = '#e07856';
const NFI_DARK = '#1a1a22';

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
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center"
                style={{ background: NFI_DARK }}
              >
                <span className="text-white font-bold text-xs tracking-tight select-none">nfi</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 leading-none">new food innovation</div>
                <div className="text-[10px] text-slate-400 tracking-widest uppercase leading-none mt-0.5">
                  Sensory Analysis Platform
                </div>
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
          <div className="flex items-center gap-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2"
                  style={{
                    borderBottomColor: active ? NFI_ORANGE : 'transparent',
                    color: active ? NFI_DARK : '#64748b',
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
