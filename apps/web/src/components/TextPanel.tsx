import { useRef } from "react";

type Props = {
  text: string;
  chars: number;
  paragraphs: number;
  onChange: (text: string) => void;
  onExample: () => void;
  onClear: () => void;
  onRelayout: () => void;
  onNotice: (message: string) => void;
};

export function TextPanel({
  text,
  chars,
  paragraphs,
  onChange,
  onExample,
  onClear,
  onRelayout,
  onNotice,
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
          {chars.toLocaleString("zh-CN")} 字 · {paragraphs} 段
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
      </div>
      <div className="panel-foot tip-foot">
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
