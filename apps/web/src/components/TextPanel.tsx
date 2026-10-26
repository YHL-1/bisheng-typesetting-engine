import { useRef } from "react";

type Props = {
  text: string;
  chars: number;
  paragraphs: number;
  lines: number;
  onChange: (text: string) => void;
  onExample: () => void;
  onClear: () => void;
  onRelayout: () => void;
  onNotice: (message: string) => void;
  onStress: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function TextPanel({
  text,
  chars,
  paragraphs,
  lines,
  onChange,
  onExample,
  onClear,
  onRelayout,
  onNotice,
  onStress,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        textareaRef.current?.focus();
        onNotice("剪贴板是空的");
        return;
      }
      onChange(clip);
      onNotice("已从剪贴板导入");
    } catch {
      textareaRef.current?.focus();
      onNotice("浏览器未授权剪贴板，请按 Ctrl+V 粘贴");
    }
  };

  return (
    <aside className="panel left">
      <div className="panel-head">
        <h2>文本</h2>
        <span className="meta">
          {chars.toLocaleString("zh-CN")} 字 · {paragraphs} 段 · {lines} 行
        </span>
      </div>

      <div className="panel-body">
        <div className="doc-meta">
          <span>示例文案</span>
          <span className="divider">·</span>
          <span>本地编辑</span>
        </div>
        <textarea
          ref={textareaRef}
          className="text-input"
          value={text}
          spellCheck={false}
          placeholder="把文案粘进来…"
          aria-label="排版文本"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onRelayout();
            }
          }}
        />
      </div>

      <div className="panel-foot">
        <button type="button" className="chip" onClick={onExample}>
          示例
        </button>
        <button type="button" className="chip" onClick={() => void handlePaste()}>
          粘贴
        </button>
        <button type="button" className="chip" onClick={onClear}>
          清空
        </button>
        <button type="button" className="chip" onClick={onStress} title="用 10 万字验证 Worker 与虚拟滚动">
          10 万字
        </button>
      </div>
      <div className="panel-foot tip-foot">
        <div className="history-controls">
          <button
            type="button"
            className="chip"
            disabled={!canUndo}
            onClick={onUndo}
            title="撤销（Ctrl+Z）"
          >
            ↶ 撤销
          </button>
          <button
            type="button"
            className="chip"
            disabled={!canRedo}
            onClick={onRedo}
            title="重做（Ctrl+Shift+Z / Ctrl+Y）"
          >
            ↷ 重做
          </button>
        </div>
        <div className="tip">
          <span>重新排版</span>
          <span>
            <kbd>Ctrl</kbd> <kbd>↵</kbd>
          </span>
        </div>
      </div>
    </aside>
  );
}
