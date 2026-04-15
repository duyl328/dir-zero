import { NavLink, useLocation } from "react-router-dom";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../hooks/useT";

export default function Sidebar() {
  const location = useLocation();
  const { session, resetSession, setScanStatus } = useAppStore();
  const t = useT();

  const navItems = [
    { to: "/overview", icon: "visibility", label: t.sidebar.overview },
    { to: "/problems", icon: "report_problem", label: t.sidebar.problems },
    { to: "/types", icon: "category", label: t.sidebar.fileTypes },
  ];

  function handleNewScan() {
    resetSession();
    setScanStatus("configuring");
  }

  return (
    <aside className="h-screen w-60 fixed left-0 top-0 bg-slate-100 flex flex-col py-6 px-4 z-50 select-none">
      {/* Logo */}
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-primary text-[18px]">folder_managed</span>
        </div>
        <div>
          <h1 className="text-base font-bold font-headline text-teal-800 leading-none">Folder Insight</h1>
          <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mt-0.5">Precision Analysis</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ to, icon, label }) => {
          const active = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-headline text-sm tracking-tight transition-colors duration-150",
                active
                  ? "text-teal-700 font-semibold border-r-2 border-teal-700 bg-slate-200/60"
                  : "text-slate-500 hover:text-teal-600 hover:bg-slate-200/50",
              ].join(" ")}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {icon}
              </span>
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* New Scan CTA */}
      <button
        onClick={handleNewScan}
        className="mb-6 mx-2 py-2.5 px-4 rounded-xl cta-gradient text-on-primary font-headline font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 active:scale-95 duration-150"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        {t.sidebar.newScan}
      </button>

      {/* Bottom links */}
      <div className="pt-4 border-t border-slate-200 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              "flex items-center gap-3 px-3 py-2 rounded-lg font-headline text-sm tracking-tight transition-colors",
              isActive
                ? "text-teal-700 font-semibold bg-slate-200/60"
                : "text-slate-500 hover:text-teal-600 hover:bg-slate-200/50",
            ].join(" ")
          }
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span>{t.sidebar.settings}</span>
        </NavLink>
      </div>

      {/* Scan status indicator */}
      {session.status === "scanning" && (
        <div className="mt-3 mx-2 px-3 py-2 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-primary truncate">
              {session.progress
                ? `${(session.progress.totalSize / 1e9).toFixed(1)} ${t.sidebar.gbFound}`
                : t.sidebar.scanning}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
