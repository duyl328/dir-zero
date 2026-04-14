import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/overview": "See Clearly",
  "/problems": "Find Problems",
  "/types": "File Types",
  "/settings": "Settings",
};

export default function TopBar() {
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? "Folder Insight";

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-15rem)] h-14 bg-white/80 backdrop-blur-xl border-b border-slate-200/20 shadow-sm flex items-center justify-between px-8 z-40">
      <div className="flex items-center gap-4 flex-1">
        <span className="font-headline font-semibold text-on-surface text-base">{title}</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
        </button>
      </div>
    </header>
  );
}
