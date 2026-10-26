import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LAYOUT_OPTIONS, countChars, countParagraphs } from "@typesetting-engine/core";
import type { Diagnostic, LayoutOptions } from "@typesetting-engine/core";
import type { DrawStats } from "@typesetting-engine/render-canvas";
import { Compare } from "./components/Compare";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { RulesPanel } from "./components/RulesPanel";
import { Stage } from "./components/Stage";
import { StatusBar } from "./components/StatusBar";
import { TextPanel } from "./components/TextPanel";
import { TopBar } from "./components/TopBar";
import type { ExportFormat, PngScale, ViewMode } from "./components/TopBar";
import { findFont } from "./fonts";
import type { FontOption } from "./fonts";
import { useCanvasMetrics } from "./hooks/useCanvasMetrics";
import { buildLayoutJson, downloadJson, exportPng } from "./lib/export";
import { exportPdf, exportTextPdf } from "./lib/pdf";
import { loadSession, saveSession } from "./lib/session";
import { useLayout } from "./hooks/useLayout";
import type { RenderReport } from "./report";
import { INITIAL_RULES } from "./rules";
import type { RuleSettings } from "./rules";
import { SAMPLE_TEXT, SAMPLE_TITLE } from "./sample";

const SAVED_SESSION = loadSession();

function App() {
  const [text, setText] = useState(SAVED_SESSION?.text ?? SAMPLE_TEXT);
  const [rules, setRules] = useState<RuleSettings>(() => ({
    ...INITIAL_RULES,
    ...(SAVED_SESSION?.rules ?? {}),
  }));
  const [report, setReport] = useState<RenderReport | null>(null);
  const [redrawKey, setRedrawKey] = useState(0);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState(0);
  const [ignoredTypes, setIgnoredTypes] = useState<ReadonlySet<Diagnostic["type"]>>(
    () => new Set(),
  );
  const [mode, setMode] = useState<ViewMode>("edit");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadedFont, setUploadedFont] = useState<
    (FontOption & { bytes: ArrayBuffer }) | null
  >(null);
  const noticeTimer = useRef<number | null>(null);
  const historyRef = useRef<{ past: string[]; future: string[] }>({
    past: [],
    future: [],
  });
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  const toggleIgnoredType = useCallback((type: Diagnostic["type"]) => {
    setIgnoredTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimer.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const font =
    uploadedFont && rules.fontId === uploadedFont.id
      ? uploadedFont
      : findFont(rules.fontId);

  const options = useMemo<LayoutOptions>(
    () => ({
      ...DEFAULT_LAYOUT_OPTIONS,
      width: rules.width,
      fontFamily: font.family,
      fontWeight: rules.fontWeight,
      fontSize: rules.fontSize,
      lineHeight: rules.lineHeight,
      letterSpacing: rules.letterSpacing,
      indent: Math.round(rules.indentChars * rules.fontSize),
      strategy: rules.strategy,
      kinsoku: rules.kinsoku,
      squeeze: rules.squeeze,
      autospace: rules.autospace,
      align: rules.align,
    }),
    [rules, font.family],
  );

  const { metrics, status, check } = useCanvasMetrics(
    options.fontFamily,
    font.probe,
    options.fontSize,
    options.fontWeight,
  );

  const {
    layout,
    elapsedMs: layoutMs,
    status: layoutStatus,
    progress: layoutProgress,
    cancel: cancelLayout,
    virtual,
  } = useLayout(text, options, metrics);
  const lines = layout?.lines.length ?? 0;
  const activeLine = Math.min(selectedLine, Math.max(0, lines - 1));
  const empty = text.trim().length === 0;

  const chars = useMemo(() => countChars(text), [text]);
  const paragraphs = useMemo(() => countParagraphs(text), [text]);

  const handleRender = useCallback(
    (stats: DrawStats) => {
      setReport({
        ...stats,
        hitRate: metrics?.stats.hitRate ?? 0,
        uniqueGlyphs: metrics?.stats.uniqueGlyphs ?? 0,
      });
    },
    [metrics],
  );

  const updateRules = useCallback((patch: Partial<RuleSettings>) => {
    setRules((current) => ({ ...current, ...patch }));
  }, []);

  const handleUploadFont = useCallback(
    async (file: File) => {
      try {
        const bytes = await file.arrayBuffer();
        const family = `BishengUpload${Date.now()}`;
        const face = new FontFace(family, bytes);
        await face.load();
        document.fonts.add(face);
        const option: FontOption & { bytes: ArrayBuffer } = {
          id: "uploaded",
          label: file.name.replace(/\.(ttf|otf)$/i, ""),
          family: `"${family}"`,
          probe: `"${family}"`,
          bytes,
        };
        setUploadedFont(option);
        updateRules({ fontId: "uploaded" });
        showNotice(`已载入字体 ${option.label}`);
      } catch {
        showNotice("字体加载失败：请上传 TTF / OTF");
      }
    },
    [showNotice, updateRules],
  );

  const commitText = useCallback(
    (next: string) => {
      if (next === text) return;
      const history = historyRef.current;
      history.past.push(text);
      if (history.past.length > 30) history.past.shift();
      history.future = [];
      setText(next);
      setHistoryState({ canUndo: true, canRedo: false });
    },
    [text],
  );

  const { canUndo, canRedo } = historyState;

  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (previous === undefined) return;
    history.future.push(text);
    setText(previous);
    setDiagnosticsOpen(false);
    setSelectedLine(0);
    setHistoryState({
      canUndo: history.past.length > 0,
      canRedo: true,
    });
  }, [text]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (next === undefined) return;
    history.past.push(text);
    if (history.past.length > 30) history.past.shift();
    setText(next);
    setDiagnosticsOpen(false);
    setSelectedLine(0);
    setHistoryState({
      canUndo: true,
      canRedo: history.future.length > 0,
    });
  }, [text]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveSession({ text, rules });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [text, rules]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape" && layoutProgress !== null) {
        event.preventDefault();
        cancelLayout();
        return;
      }
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, layoutProgress, cancelLayout]);

  const openDiagnostics = useCallback(() => {
    setDiagnosticsOpen(true);
    setSelectedLine(layout?.diagnostics[0]?.line ?? 0);
  }, [layout]);

  const closeDiagnostics = useCallback(() => {
    setDiagnosticsOpen(false);
  }, []);

  const handleSelectLine = useCallback((line: number) => {
    setDiagnosticsOpen(true);
    setSelectedLine(line);
  }, []);

  const toggleDiagnostics = useCallback(() => {
    if (diagnosticsOpen) setDiagnosticsOpen(false);
    else openDiagnostics();
  }, [diagnosticsOpen, openDiagnostics]);

  const handleExportJson = useCallback(() => {
    if (!layout) return;
    downloadJson(buildLayoutJson(text, options, layout), "bisheng-layout.json");
    showNotice("已导出排版 JSON");
  }, [layout, text, options, showNotice]);

  const handleExport = useCallback(
    async (format: ExportFormat, scale: PngScale = 2) => {
      if (!layout) return;
      setExporting(true);
      try {
        if (format === "json") {
          handleExportJson();
        } else if (format === "png") {
          const size = await exportPng(layout, options, scale);
          showNotice(
            size.parts > 1
              ? `已导出 PNG ${size.parts} 片 · ${size.width}×${size.height}`
              : `已导出 PNG ${size.width}×${size.height}`,
          );
        } else if (format === "pdf-text") {
          if (!uploadedFont) {
            showNotice("请先在右侧上传 TTF / OTF 字体");
            return;
          }
          const result = await exportTextPdf(layout, options, text, uploadedFont.bytes);
          showNotice(`已导出文字版 PDF ${result.pages} 页`);
        } else {
          const result = await exportPdf(layout, options, text, 2);
          showNotice(`已导出 PDF ${result.pages} 页`);
        }
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "导出失败");
      } finally {
        setExporting(false);
      }
    },
    [layout, options, text, uploadedFont, handleExportJson, showNotice],
  );

  const handleWidthChange = useCallback(
    (width: number) => {
      updateRules({ width });
    },
    [updateRules],
  );

  const resetRules = useCallback(() => {
    setRules(INITIAL_RULES);
    setRedrawKey((key) => key + 1);
    showNotice("规则已重置");
  }, [showNotice]);

  const handleRelayout = useCallback(() => {
    setRedrawKey((key) => key + 1);
    showNotice("已重新排版");
  }, [showNotice]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const content = await file.text();
        commitText(content);
        showNotice(`已导入 ${file.name}`);
      } catch {
        showNotice("文件读取失败");
      }
    },
    [commitText, showNotice],
  );

  const handleExample = useCallback(() => {
    commitText(SAMPLE_TEXT);
    showNotice("已恢复示例文案");
  }, [commitText, showNotice]);

  const handleClear = useCallback(() => {
    commitText("");
    showNotice("已清空文本");
  }, [commitText, showNotice]);

  const handleStress = useCallback(() => {
    commitText("中".repeat(100_000));
    showNotice("已载入 10 万字压测文本");
  }, [commitText, showNotice]);

  return (
    <div className="app">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        onImport={(file) => void handleImport(file)}
        onExport={(format, scale) => void handleExport(format, scale)}
        canExport={layout !== null}
        textPdfAvailable={uploadedFont !== null}
        exporting={exporting}
      />

      {mode === "compare" ? (
        <Compare text={text} options={options} metrics={metrics} fontLabel={font.label} />
      ) : (
      <main className="workspace">
        <TextPanel
          text={text}
          chars={chars}
          paragraphs={paragraphs}
          lines={lines}
          onChange={commitText}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onExample={handleExample}
          onClear={handleClear}
          onRelayout={handleRelayout}
          onNotice={showNotice}
          onStress={handleStress}
        />

        <Stage
          title={SAMPLE_TITLE}
          text={text}
          options={options}
          fontLabel={font.label}
          metrics={metrics}
          layout={layout}
          layoutStatus={layoutStatus}
          layoutProgress={layoutProgress}
          onCancelLayout={cancelLayout}
          virtual={virtual}
          empty={empty}
          redrawKey={redrawKey}
          diagnosticsOpen={diagnosticsOpen}
          selectedLine={activeLine}
          ignoredTypes={ignoredTypes}
          onToggleDiagnostics={toggleDiagnostics}
          onSelectLine={handleSelectLine}
          onWidthChange={handleWidthChange}
          onRender={handleRender}
        />

        {diagnosticsOpen && layout ? (
          <DiagnosticsPanel
            layout={layout}
            text={text}
            options={options}
            selectedLine={activeLine}
            ignoredTypes={ignoredTypes}
            onSelectLine={handleSelectLine}
            onToggleIgnored={toggleIgnoredType}
            onClose={closeDiagnostics}
            onExportJson={handleExportJson}
          />
        ) : (
          <RulesPanel
            settings={rules}
            customFont={uploadedFont}
            onChange={updateRules}
            onUploadFont={(file) => void handleUploadFont(file)}
            onReset={resetRules}
          />
        )}
      </main>
      )}

      <StatusBar
        status={status}
        check={check}
        report={report}
        chars={chars}
        paragraphs={paragraphs}
        lines={lines}
        layoutMs={layoutMs}
        layoutStatus={layoutStatus}
        layoutProgress={layoutProgress}
        virtual={virtual}
      />

      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

export default App;
