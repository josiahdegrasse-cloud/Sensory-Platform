import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Beaker, Lightbulb } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect } from "react";

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
    { path: "/survey-analysis", label: "Analyze Results", icon: BarChart3 },
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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* NFI logo — top left */}
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
                <Beaker className="size-4 text-white" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900 leading-none">NFI</div>
                <div className="text-[10px] text-slate-400 tracking-widest uppercase font-medium leading-none mt-0.5">New Food Innovation</div>
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
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {Icon && <Icon className="size-4" />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
