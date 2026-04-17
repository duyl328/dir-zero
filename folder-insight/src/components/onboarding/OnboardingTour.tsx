import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/appStore";

const STORAGE_KEY = "onboarding_done_v1";

interface Step {
  targetId: string;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
  placement: "right" | "bottom" | "left" | "top";
  navigateTo?: string;
  spotlightPadding?: number;
}

const STEPS: Step[] = [
  {
    targetId: "tour-logo",
    titleZh: "欢迎使用 Folder Insight",
    titleEn: "Welcome to Folder Insight",
    descZh: "这是一款 Windows 磁盘空间分析工具，帮你快速找出占用空间的大文件、重复文件和垃圾残留，让硬盘重获自由。",
    descEn: "A Windows disk space analyzer that helps you find large files, duplicates, and junk — so you can reclaim your storage.",
    placement: "right",
    navigateTo: "/overview",
  },
  {
    targetId: "tour-new-scan",
    titleZh: "第一步：新建扫描",
    titleEn: "Step 1: Start a Scan",
    descZh: "点击「新建扫描」选择要分析的文件夹或整个盘符，扫描完成后会立即展示空间分布图。",
    descEn: 'Click "New Scan" to pick a folder or drive. The treemap appears as scanning progresses.',
    placement: "right",
    navigateTo: "/overview",
  },
  {
    targetId: "tour-overview-nav",
    titleZh: "透视：空间分布一目了然",
    titleEn: "Overview: See Where Space Goes",
    descZh: "扫描后在这里查看交互式矩形树图，单击展开文件夹，双击下钻，快速定位占用大户。",
    descEn: "After scanning, explore the interactive treemap. Single-click to expand, double-click to drill down.",
    placement: "right",
    navigateTo: "/overview",
  },
  {
    targetId: "tour-problems-nav",
    titleZh: "发现问题：找出可清理内容",
    titleEn: "Find Problems: Clean Up",
    descZh: "自动检测重复文件、空文件夹、零字节文件和系统残留，一键移到回收站。",
    descEn: "Auto-detects duplicates, empty folders, zero-byte files, and junk. Move them to trash in one click.",
    placement: "right",
    navigateTo: "/problems",
  },
  {
    targetId: "tour-types-nav",
    titleZh: "文件类型：按类别分析",
    titleEn: "File Types: Analyze by Category",
    descZh: "按视频、图片、代码等 15 种类型查看占用分布，支持按大小或数量排序，快速找到某类文件的大户目录。",
    descEn: "View space usage across 15 file categories. Sort by size or count, and drill into top directories.",
    placement: "right",
    navigateTo: "/types",
  },
];

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function BubbleArrow({ placement }: { placement: Step["placement"] }) {
  const base = "absolute w-3 h-3 bg-surface-container-lowest rotate-45 border border-outline-variant/20";
  if (placement === "right") return <div className={`${base} -left-1.5 top-6`} style={{ borderRight: "none", borderTop: "none" }} />;
  if (placement === "left")  return <div className={`${base} -right-1.5 top-6`} style={{ borderLeft: "none", borderBottom: "none" }} />;
  if (placement === "bottom") return <div className={`${base} -top-1.5 left-6`} style={{ borderLeft: "none", borderTop: "none" }} />;
  return <div className={`${base} -bottom-1.5 left-6`} style={{ borderRight: "none", borderBottom: "none" }} />;
}

export default function OnboardingTour() {
  const locale = useAppStore((s) => s.locale);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const current = STEPS[step];
  const isZh = locale === "zh";
  const title = isZh ? current.titleZh : current.titleEn;
  const desc  = isZh ? current.descZh  : current.descEn;
  const pad   = current.spotlightPadding ?? 8;

  // Navigate to the right page when step changes
  useEffect(() => {
    if (current.navigateTo) navigate(current.navigateTo);
  }, [step]);

  // Poll for target element (it may not be in DOM immediately after navigation)
  useEffect(() => {
    let attempts = 0;
    function poll() {
      const r = getTargetRect(current.targetId);
      if (r) {
        setRect(r);
        setVisible(true);
      } else if (attempts++ < 30) {
        rafRef.current = requestAnimationFrame(poll);
      }
    }
    setVisible(false);
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    // small delay so fade-out plays
    setTimeout(() => {
      // signal parent to unmount
      window.dispatchEvent(new Event("onboarding-done"));
    }, 200);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  }

  function skip() { finish(); }

  if (!rect) return null;

  // Spotlight clip region
  const sp = {
    top:    rect.top    - pad,
    left:   rect.left   - pad,
    width:  rect.width  + pad * 2,
    height: rect.height + pad * 2,
  };

  // Bubble position
  const GAP = 16;
  let bubbleStyle: React.CSSProperties = {};
  if (current.placement === "right") {
    bubbleStyle = { top: sp.top, left: sp.left + sp.width + GAP };
  } else if (current.placement === "left") {
    bubbleStyle = { top: sp.top, right: window.innerWidth - sp.left + GAP };
  } else if (current.placement === "bottom") {
    bubbleStyle = { top: sp.top + sp.height + GAP, left: sp.left };
  } else {
    bubbleStyle = { bottom: window.innerHeight - sp.top + GAP, left: sp.left };
  }

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {/* Dark overlay with spotlight hole via clip-path */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${sp.top}px,
            ${sp.left}px ${sp.top}px,
            ${sp.left}px ${sp.top + sp.height}px,
            ${sp.left + sp.width}px ${sp.top + sp.height}px,
            ${sp.left + sp.width}px ${sp.top}px,
            0% ${sp.top}px
          )`,
        }}
        onClick={skip}
      />

      {/* Spotlight border ring */}
      <div
        className="absolute rounded-xl border-2 border-primary/60 shadow-[0_0_0_4px_rgba(var(--md-primary),0.15)] pointer-events-none transition-all duration-300"
        style={{ top: sp.top, left: sp.left, width: sp.width, height: sp.height }}
      />

      {/* Bubble */}
      <div
        className="absolute w-72 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 p-5 transition-all duration-300"
        style={bubbleStyle}
      >
        <BubbleArrow placement={current.placement} />

        {/* Step dots */}
        <div className="flex items-center gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={[
                "rounded-full transition-all duration-200",
                i === step ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-outline-variant/50",
              ].join(" ")}
            />
          ))}
        </div>

        <h3 className="font-headline font-extrabold text-sm text-on-surface mb-1.5 leading-snug">{title}</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed mb-4">{desc}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={skip}
            className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
          >
            {isZh ? "跳过引导" : "Skip"}
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg cta-gradient text-on-primary text-xs font-bold shadow-sm active:scale-95 transition-all"
          >
            {step < STEPS.length - 1
              ? (isZh ? "下一步" : "Next")
              : (isZh ? "开始使用" : "Get Started")}
            {step < STEPS.length - 1 && (
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldShowTour(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}
