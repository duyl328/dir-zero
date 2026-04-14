import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Use capture so we catch it before bubbling prevents it
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Clamp to viewport
  const menuW = 200;
  const menuH = items.length * 36 + 16;
  const clampedX = Math.min(x, window.innerWidth - menuW - 8);
  const clampedY = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 py-1.5 overflow-hidden"
      style={{ left: clampedX, top: clampedY, minWidth: menuW }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={[
            "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors text-left",
            item.danger
              ? "text-error hover:bg-error/10"
              : "text-on-surface hover:bg-surface-container-high",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
