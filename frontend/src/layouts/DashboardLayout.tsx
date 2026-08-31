import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Visão Geral', icon: DashboardIcon },
  { to: '/dashboards', label: 'Dashboards', icon: ChartIcon },
  { to: '/pedidos', label: 'Pedidos', icon: OrderIcon, adminOnly: true },
  { to: '/admin/estoque', label: 'Estoque', icon: BoxIcon, adminOnly: true },
  { to: '/admin/fornecedores', label: 'Fornecedores', icon: TruckIcon, adminOnly: true },
  { to: '/revendedoras', label: 'Revendedoras', icon: PeopleIcon },
  { to: '/admin/promocoes', label: 'Promoções', icon: SparkleIcon, adminOnly: true },
];

export default function DashboardLayout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Fecha o menu mobile ao trocar de rota
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  // Bloqueia o scroll do fundo quando o drawer está aberto
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  // Conteúdo de navegação reutilizado no sidebar (desktop) e no drawer (mobile)
  const navContent = (
    <>
      {/* Brand */}
      <div className="px-6 py-6 border-b border-charcoal-100/40 dark:border-charcoal-700/40">
        <Logo className="h-28 mx-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-semibold text-charcoal-300 dark:text-charcoal-500 uppercase tracking-wider">Menu</p>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gold-50 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400 shadow-sm border border-gold-200/50 dark:border-gold-800/50'
                  : 'text-charcoal-500 dark:text-charcoal-400 hover:bg-cream-200 dark:hover:bg-charcoal-700 hover:text-charcoal-700 dark:hover:text-charcoal-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon active={isActive} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Catalog link */}
      <div className="px-4 pb-3">
        <a
          href="/catalogo"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-dashed border-charcoal-200 dark:border-charcoal-600 px-3 py-2.5 text-xs text-charcoal-400 dark:text-charcoal-500 hover:border-gold hover:text-gold transition-all"
        >
          <ExternalIcon />
          <span>Ver catálogo público</span>
        </a>
      </div>

      {/* Theme toggle + User section */}
      <div className="border-t border-charcoal-100/40 dark:border-charcoal-700/40 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold text-charcoal-300 dark:text-charcoal-500 uppercase tracking-wider">Tema</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-200 dark:bg-charcoal-700 text-charcoal-500 dark:text-charcoal-300 text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-charcoal-700 dark:text-charcoal-200">{user?.name}</p>
            <p className="truncate text-xs text-charcoal-400 dark:text-charcoal-500">
              {user?.role === 'ROLE_ADMIN' ? 'Administrador' : 'Operador'}
            </p>
          </div>
          <button
            onClick={logout}
            className="shrink-0 rounded-lg p-2 text-charcoal-300 dark:text-charcoal-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
            title="Sair"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-cream dark:bg-charcoal-900">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-[260px] flex-col bg-white dark:bg-charcoal-800 border-r border-charcoal-100/40 dark:border-charcoal-700/40">
        {navContent}
      </aside>

      {/* Drawer de navegação (mobile) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          {/* Painel deslizante */}
          <aside className="absolute left-0 top-0 h-full w-[80%] max-w-[300px] flex flex-col bg-white dark:bg-charcoal-800 shadow-2xl">
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-charcoal-100/40 dark:border-charcoal-700/40 bg-white dark:bg-charcoal-800 px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={mobileNavOpen}
            className="rounded-lg p-2 text-charcoal-500 dark:text-charcoal-300 hover:bg-cream-200 dark:hover:bg-charcoal-700 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
          <Logo className="h-12" />
          <ThemeToggle />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Icons (clean, minimal stroke) ───────────────────────────────────────────

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v16.5A1.5 1.5 0 004.5 21H21M7.5 15l3-3 3 3 4.5-4.5" />
    </svg>
  );
}

function OrderIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

function SparkleIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

function BoxIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function TruckIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-[18px] w-[18px] ${active ? 'text-gold' : 'text-charcoal-400 group-hover:text-charcoal-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}
