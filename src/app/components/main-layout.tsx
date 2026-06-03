import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { FlaskConical, BarChart3, GitMerge, ClipboardList, Settings, LogOut, Lightbulb, Tag, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useEffect, useMemo, useState } from "react";
import { useProducts } from "../lib/hooks";
import { useFoodType, matchFoodType, type FoodType } from "../contexts/food-type-context";

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

function CategorySidebar() {
  const { data: products = [] } = useProducts();
  const { foodType, subCategory, setSelection } = useFoodType();
  const [cheeseOpen, setCheeseOpen] = useState(foodType === 'cheese');
  const [breadOpen, setBreadOpen] = useState(foodType === 'bread');

  const cheeseSubs = useMemo(() => {
    const cats = new Set(
      products.filter(p => matchFoodType(p.category) === 'cheese').map(p => p.category)
    );
    return Array.from(cats).sort();
  }, [products]);

  const breadSubs = useMemo(() => {
    const cats = new Set(
      products.filter(p => matchFoodType(p.category) === 'bread').map(p => p.category)
    );
    return Array.from(cats).sort();
  }, [products]);

  const handleTopLevel = (ft: FoodType) => {
    setSelection(ft, null);
    if (ft === 'cheese') { setCheeseOpen(true); setBreadOpen(false); }
    else if (ft === 'bread') { setBreadOpen(true); setCheeseOpen(false); }
    else { setCheeseOpen(false); setBreadOpen(false); }
  };

  const handleSub = (ft: FoodType, cat: string) => {
    setSelection(ft, cat);
  };

  const isActive = (ft: FoodType, sub?: string) =>
    foodType === ft && (sub === undefined ? subCategory === null : subCategory === sub);

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

          {/* All Types */}
          <button
            onClick={() => handleTopLevel('all')}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors"
            style={btnStyle(foodType === 'all')}
          >
            All Types
          </button>

          {/* Cheese section */}
          <div>
            <button
              onClick={() => {
                if (foodType === 'cheese' && !subCategory) {
                  setCheeseOpen(v => !v);
                } else {
                  handleTopLevel('cheese');
                }
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
              style={btnStyle(foodType === 'cheese')}
            >
              <span className="mr-0.5">🧀</span>
              <span className="flex-1">Cheese</span>
              {cheeseSubs.length > 0 && (
                <ChevronRight
                  className="size-3.5 transition-transform shrink-0"
                  style={{ transform: cheeseOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
              )}
            </button>
            {cheeseOpen && cheeseSubs.length > 0 && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l-2 border-slate-100 pl-2">
                <button
                  onClick={() => setSelection('cheese', null)}
                  className="w-full text-left px-2 py-1 rounded-md text-xs transition-colors"
                  style={btnStyle(isActive('cheese', undefined))}
                >
                  All Cheese
                </button>
                {cheeseSubs.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleSub('cheese', cat)}
                    className="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                    style={btnStyle(subCategory === cat && foodType === 'cheese')}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bread section */}
          <div>
            <button
              onClick={() => {
                if (foodType === 'bread' && !subCategory) {
                  setBreadOpen(v => !v);
                } else {
                  handleTopLevel('bread');
                }
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
              style={btnStyle(foodType === 'bread')}
            >
              <span className="mr-0.5">🍞</span>
              <span className="flex-1">Bread</span>
              {breadSubs.length > 0 && (
                <ChevronRight
                  className="size-3.5 transition-transform shrink-0"
                  style={{ transform: breadOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
              )}
            </button>
            {breadOpen && breadSubs.length > 0 && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l-2 border-slate-100 pl-2">
                <button
                  onClick={() => setSelection('bread', null)}
                  className="w-full text-left px-2 py-1 rounded-md text-xs transition-colors"
                  style={btnStyle(isActive('bread', undefined))}
                >
                  All Bread
                </button>
                {breadSubs.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleSub('bread', cat)}
                    className="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                    style={btnStyle(subCategory === cat && foodType === 'bread')}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </aside>
  );
}

function FoodTypeBadge() {
  const { foodType, subCategory } = useFoodType();
  if (foodType === 'all') return null;
  const label = subCategory ?? (foodType === 'cheese' ? '🧀 Cheese' : '🍞 Bread');
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
