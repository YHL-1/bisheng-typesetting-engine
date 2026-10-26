import type { GlyphWidthCheck } from "@typesetting-engine/render-canvas";
import { VERSION } from "../constants";
import type { FontStatus } from "../hooks/useCanvasMetrics";
import type { LayoutStatus } from "../hooks/useLayout";
import type { RenderReport } from "../report";

type Props = {
  status: FontStatus;
  check: GlyphWidthCheck | null;
  report: RenderReport | null;
  chars: number;
  paragraphs: number;
  lines: number;
  layoutMs: number | null;
  layoutStatus: LayoutStatus;
  layoutProgress: number | null;
  virtual: boolean;
};

function formatElapsed(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) return "—";
  if (milliseconds < 0.1) return "<0.1 ms";
  return `${milliseconds.toFixed(1)} ms`;
}

export function StatusBar({
  status,
  check,
  report,
  chars,
  paragraphs,
  lines,
  layoutMs,
  layoutStatus,
  layoutProgress,
  virtual,
}: Props) {
  const timingTitle =
    report === null
      ? undefined
      : `排版 ${formatElapsed(layoutMs)} · 绘制 ${formatElapsed(report.elapsedMs)}`;

  const label =
    status === "loading"
      ? "字体加载中…"
      : layoutProgress !== null || layoutStatus === "working"
        ? `大文档排版中${layoutProgress === null ? "…" : ` ${layoutProgress}%`}`
        : layoutStatus === "cancelled"
          ? "排版已取消"
          : layoutStatus === "error"
            ? "排版失败"
            : status === "fallback"
              ? "回退字体"
              : "排版完成";

  const dot =
    layoutProgress !== null || layoutStatus === "working"
      ? "loading"
      : layoutStatus === "error" || layoutStatus === "cancelled"
        ? "fallback"
        : status;

  return (
    <footer className="statusbar" aria-live="polite">
      <span>
        <i className={`dot ${dot}`} />
        {label}
      </span>
      <span className="mono" title={timingTitle}>
        {formatElapsed(layoutMs)}
      </span>
      <span>
        {chars.toLocaleString("zh-CN")} 字 · {paragraphs} 段 · {lines} 行
      </span>
      <span>度量缓存 {report ? `${Math.round(report.hitRate * 100)}%` : "—"}</span>

      <span className="spacer" />

      {virtual ? (
        <span className="milestone-tag">
          Worker{layoutProgress !== null ? ` ${layoutProgress}%` : ""}
        </span>
      ) : null}
      <span className="milestone-tag">D6 · 大文档</span>
      <span
        title={
          check
            ? `metrics ${check.metric.toFixed(3)} / measureText ${check.measured.toFixed(3)}`
            : undefined
        }
      >
        度量校验 {check ? `Δ${check.delta.toFixed(2)}px` : "—"}
      </span>
      <span>core 0 DOM 依赖</span>
      <span className="mono">v{VERSION}</span>
    </footer>
  );
}
