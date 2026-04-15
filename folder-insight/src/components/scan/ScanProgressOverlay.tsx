import { useAppStore } from "../../store/appStore";
import { useT } from "../../hooks/useT";

function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${(bytes / 1e3).toFixed(0)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(2)} GB`;
}

function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

export default function ScanProgressOverlay() {
  const { session, setScanStatus } = useAppStore();
  const t = useT();
  const progress = session.progress;

  function handleCancel() {
    setScanStatus("idle");
  }

  const mode = progress?.mode === "mft" ? t.scanProgress.fastMode : t.scanProgress.compatMode;
  const modeColor = progress?.mode === "mft" ? "text-tertiary" : "text-on-surface-variant";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/10 w-full max-w-lg mx-4 p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[24px]">radar</span>
            </div>
          </div>
        </div>

        <h2 className="font-headline text-xl font-extrabold text-on-surface text-center mb-1">
          {t.scanProgress.scanning}
        </h2>

        <p className="text-sm text-on-surface-variant text-center mb-6 truncate px-4">
          {session.roots.join(", ")}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">{t.scanProgress.filesFound}</p>
            <p className="font-headline text-2xl font-extrabold text-on-surface">
              {progress ? formatCount(progress.filesFound) : "—"}
            </p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">{t.scanProgress.totalSize}</p>
            <p className="font-headline text-2xl font-extrabold text-on-surface">
              {progress ? formatBytes(progress.totalSize) : "—"}
            </p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-lg px-4 py-2.5 mb-4 min-h-[36px]">
          <p className="text-[11px] font-mono text-on-surface-variant truncate">
            {progress?.currentPath ?? t.scanProgress.initializing}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          <span className={`material-symbols-outlined text-[14px] ${modeColor}`}>bolt</span>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${modeColor}`}>{mode}</span>
        </div>

        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mb-6">
          <div className="h-full bg-primary rounded-full animate-[scan-bar_1.8s_ease-in-out_infinite]" style={{ width: "40%" }} />
        </div>

        <button
          onClick={handleCancel}
          className="w-full py-2.5 rounded-lg border border-outline-variant/30 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          {t.scanProgress.cancel}
        </button>
      </div>
    </div>
  );
}
