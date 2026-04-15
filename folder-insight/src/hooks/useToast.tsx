import { useState, useCallback, useRef } from "react";

interface Toast {
  id: number;
  message: string;
  icon?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, icon = "check_circle") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);
  }, []);

  const ToastContainer = (
    <div className="fixed bottom-28 right-6 flex flex-col items-end gap-2 z-[300] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-on-surface text-xs font-semibold shadow-lg animate-fade-in-up"
        >
          <span className="material-symbols-outlined text-[15px] text-primary">{t.icon}</span>
          {t.message}
        </div>
      ))}
    </div>
  );

  return { show, ToastContainer };
}
