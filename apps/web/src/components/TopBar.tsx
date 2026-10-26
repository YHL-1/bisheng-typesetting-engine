import { useRef } from "react";

type Props = {
  onImport: (file: File) => void;
};

export function TopBar({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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
          <button type="button" className="on">
            编辑
          </button>
          <button type="button" disabled title="D5 接入三栏对比">
            对比
          </button>
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()}>
          导入 .txt
        </button>
        <button type="button" className="btn solid" disabled title="D6 接入导出">
          导出
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
