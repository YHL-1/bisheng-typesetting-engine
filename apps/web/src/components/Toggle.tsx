type Props = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
};

export function Toggle({ label, description, checked, onChange, disabled, title }: Props) {
  return (
    <div className="switch-row" title={title}>
      <div className="txt">
        <div className="t">{label}</div>
        <div className="s">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`sw${checked ? "" : " off"}`}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </div>
  );
}
