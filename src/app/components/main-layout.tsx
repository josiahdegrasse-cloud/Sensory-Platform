import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, Users, BarChart3, GitMerge, ClipboardList, Settings, LogOut, ChevronRight } from "lucide-react";
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

  // Role-based navigation
  const getDeveloperNavItems = () => [
    { path: "/", label: "Overview", icon: null },
    { path: "/stage1", label: "Machine Testing", icon: FlaskConical },
    { path: "/stage2", label: "Panelist Forms", icon: Users },
    { path: "/survey-analysis", label: "Analyze Results", icon: BarChart3 },
    { path: "/decision", label: "Final Decision", icon: GitMerge },
    { path: "/dairy-comparison", label: "Dairy Comparison", icon: ChevronRight },
    { path: "/admin", label: "Configure Products", icon: Settings },
  ];

  const getPanelistNavItems = () => [
    { path: "/panelist", label: "My Questionnaires", icon: ClipboardList },
  ];

  const getAdminNavItems = () => [
    { path: "/stage1", label: "Machine Testing", icon: FlaskConical },
    { path: "/survey-analysis", label: "Analyze Results", icon: BarChart3 },
    { path: "/decision", label: "Final Decision", icon: GitMerge },
    { path: "/admin", label: "Configure Products", icon: Settings },
  ];

  const navItems = 
    user?.role === 'admin' ? getAdminNavItems() :
    user?.role === 'developer' ? getDeveloperNavItems() :
    getPanelistNavItems();

  // Redirect based on role
  useEffect(() => {
    if (user?.role === 'panelist' && location.pathname === '/') {
      navigate('/panelist');
    }
    if (user?.role === 'admin' && location.pathname === '/') {
      navigate('/stage1');
    }
  }, [user, location.pathname, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">ISSF Dashboard</h1>
              <p className="text-xs text-emerald-700 mt-1">✓ Mixed Panel Method: Semi-trained + E-Tongue + GC-O</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900">{user?.name}</div>
                <div className="text-xs text-slate-500">
                  {user?.role === 'panelist' ? `Panelist ${user?.panelistId}` : 
                   user?.role === 'admin' ? 'Administrator' : user?.role}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="size-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-800">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
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

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}