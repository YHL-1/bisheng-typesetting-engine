import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LAYOUT_OPTIONS, countChars, countParagraphs } from "@typesetting-engine/core";
import type { LayoutOptions } from "@typesetting-engine/core";
import type { CanvasMetrics, DrawStats } from "@typesetting-engine/render-canvas";
import { RulesPanel } from "./components/RulesPanel";
import { Stage } from "./components/Stage";
import { StatusBar } from "./components/StatusBar";
import { TextPanel } from "./components/TextPanel";
import { TopBar } from "./components/TopBar";
import { findFont } from "./fonts";
import { useCanvasMetrics } from "./hooks/useCanvasMetrics";
import type { RenderReport } from "./report";
import { INITIAL_RULES } from "./rules";
import type { RuleSettings } from "./rules";
import { SAMPLE_TEXT, SAMPLE_TITLE } from "./sample";

function App() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [rules, setRules] = useState<RuleSettings>(INITIAL_RULES);
  const [report, setReport] = useState<RenderReport | null>(null);
  const [redrawKey, setRedrawKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

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

  const font = findFont(rules.fontId);

  const options = useMemo<LayoutOptions>(
    () => ({
      ...DEFAULT_LAYOUT_OPTIONS,
      width: rules.width,
      fontFamily: font.family,
      fontSize: rules.fontSize,
      lineHeight: rules.lineHeight,
      letterSpacing: rules.letterSpacing,
      indent: Math.round(rules.indentChars * rules.fontSize),
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
  );

  const chars = useMemo(() => countChars(text), [text]);
  const paragraphs = useMemo(() => countParagraphs(text), [text]);

  const handleRender = useCallback((stats: DrawStats, activeMetrics: CanvasMetrics) => {
    setReport({
      ...stats,
      hitRate: activeMetrics.stats.hitRate,
      uniqueGlyphs: activeMetrics.stats.uniqueGlyphs,
    });
  }, []);

  const updateRules = useCallback((patch: Partial<RuleSettings>) => {
    setRules((current) => ({ ...current, ...patch }));
  }, []);

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
        setText(content);
        showNotice(`已导入 ${file.name}`);
      } catch {
        showNotice("文件读取失败");
      }
    },
    [showNotice],
  );

  const handleExample = useCallback(() => {
    setText(SAMPLE_TEXT);
    showNotice("已恢复示例文案");
  }, [showNotice]);

  const handleClear = useCallback(() => {
    setText("");
    showNotice("已清空文本");
  }, [showNotice]);

  return (
    <div className="app">
      <TopBar onImport={(file) => void handleImport(file)} />

      <main className="workspace">
        <TextPanel
          text={text}
          chars={chars}
          paragraphs={paragraphs}
          onChange={setText}
          onExample={handleExample}
          onClear={handleClear}
          onRelayout={handleRelayout}
          onNotice={showNotice}
        />

        <Stage
          title={SAMPLE_TITLE}
          text={text}
          options={options}
          fontLabel={font.label}
          metrics={metrics}
          redrawKey={redrawKey}
          onWidthChange={handleWidthChange}
          onRender={handleRender}
        />

        <RulesPanel settings={rules} onChange={updateRules} onReset={resetRules} />
      </main>

      <StatusBar
        status={status}
        check={check}
        report={report}
        chars={chars}
        paragraphs={paragraphs}
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
