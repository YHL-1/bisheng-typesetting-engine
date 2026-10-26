import { useRef, useState } from "react";

export type ExportFormat = "png" | "pdf" | "pdf-text" | "json";
export type PngScale = 1 | 2 | 3;
export type ViewMode = "edit" | "compare";

type Props = {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onImport: (file: File) => void;
  onExport: (format: ExportFormat, scale?: PngScale) => void;
  canExport: boolean;
  textPdfAvailable: boolean;
  exporting: boolean;
};

const EXPORT_ITEMS: ReadonlyArray<{
  format: ExportFormat;
  scale?: PngScale;
  icon: string;
  title: string;
  detail: string;
  hint?: string;
}> = [
  { format: "png", scale: 1, icon: "PNG", title: "PNG 1x", detail: "原始像素 · 网页/预览用" },
  { format: "png", scale: 2, icon: "PNG", title: "PNG 2x", detail: "高清 2x · 默认导出" },
  { format: "png", scale: 3, icon: "PNG", title: "PNG 3x", detail: "超清 3x · 印刷前检查" },
  { format: "pdf", icon: "PDF", title: "PDF（图片版）", detail: "A4 分页 · 文字不可选" },
  {
    format: "pdf-text",
    icon: "PDF",
    title: "PDF（文字版·实验）",
    detail: "嵌入上传字体 · 复制/搜索可能乱码",
    hint: "需上传字体",
  },
  { format: "json", icon: "JSON", title: "排版 JSON", detail: "lines + glyphs + diagnostics" },
];

export function TopBar({
  mode,
  onModeChange,
  onImport,
  onExport,
  canExport,
  textPdfAvailable,
  exporting,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const choose = (format: ExportFormat, scale?: PngScale) => {
    setExportOpen(false);
    onExport(format, scale);
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="seal">毕</div>
        <div>
          <div className="logo">毕昇</div>
        </div>
        <span className="brand-sub">Bi Sheng</span>
      </div>

      <div className="modes">
        <div className="segmented" role="group" aria-label="视图">
          <button
            type="button"
            className={mode === "edit" ? "on" : undefined}
            aria-pressed={mode === "edit"}
            onClick={() => onModeChange("edit")}
          >
            编辑
          </button>
          <button
            type="button"
            className={mode === "compare" ? "on" : undefined}
            aria-pressed={mode === "compare"}
            onClick={() => onModeChange("compare")}
          >
            对比
          </button>
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()}>
          导入 .txt
        </button>

        <div className="export-wrap">
          <button
            type="button"
            className="btn solid"
            disabled={!canExport || exporting}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((open) => !open)}
          >
            {exporting ? "导出中…" : "导出"}
            <svg width="9" height="9" viewBox="0 0 10 10" className="caret" aria-hidden="true">
              <path
                d="M2 3.5 5 7l3-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {exportOpen ? (
            <>
              <button
                type="button"
                className="export-backdrop"
                aria-label="关闭导出菜单"
                onClick={() => setExportOpen(false)}
              />
              <div className="export-menu" role="menu">
                <div className="export-head">
                  <b>导出</b>
                  <span>完整文本 · 当前规则</span>
                </div>
                {EXPORT_ITEMS.map((item) => (
                  <button
                    type="button"
                    className="export-item"
                    role="menuitem"
                    key={`${item.format}-${item.scale ?? ""}`}
                    disabled={item.format === "pdf-text" && !textPdfAvailable}
                    onClick={() => choose(item.format, item.scale)}
                  >
                    <span className="export-icon mono">{item.icon}</span>
                    <span className="export-text">
                      <b>{item.title}</b>
                      <span>{item.detail}</span>
                    </span>
                    {item.hint ? <span className="export-hint">{item.hint}</span> : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="avatar" aria-hidden="true" />
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
