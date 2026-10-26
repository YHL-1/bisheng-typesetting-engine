import type { GlyphWidthCheck } from "@typesetting-engine/render-canvas";
import { VERSION } from "../constants";
import type { FontStatus } from "../hooks/useCanvasMetrics";
import type { RenderReport } from "../report";

type Props = {
  status: FontStatus;
  check: GlyphWidthCheck | null;
  report: RenderReport | null;
  chars: number;
  paragraphs: number;
};

const STATUS_LABEL: Record<FontStatus, string> = {
  loading: "字体加载中…",
  ready: "排版完成",
  fallback: "回退字体",
};

function formatElapsed(milliseconds: number | undefined): string {
  if (milliseconds === undefined) return "—";
  if (milliseconds < 0.1) return "<0.1 ms";
  return `${milliseconds.toFixed(1)} ms`;
}

export function StatusBar({ status, check, report, chars, paragraphs }: Props) {
  return (
    <footer className="statusbar">
      <span>
        <i className={`dot ${status}`} />
        {STATUS_LABEL[status]}
      </span>
      <span className="mono">{formatElapsed(report?.elapsedMs)}</span>
      <span>
        {chars.toLocaleString("zh-CN")} 字 · {paragraphs} 段
      </span>
      <span>度量缓存 {report ? `${Math.round(report.hitRate * 100)}%` : "—"}</span>

      <span className="spacer" />

      <span className="d1-tag">D1 · 单行</span>
      <span title={check ? `metrics ${check.metric.toFixed(3)} / measureText ${check.measured.toFixed(3)}` : undefined}>
        度量校验 {check ? `Δ${check.delta.toFixed(2)}px` : "—"}
      </span>
      <span>core 0 DOM 依赖</span>
      <span className="mono">v{VERSION}</span>
    </footer>
  );
}
