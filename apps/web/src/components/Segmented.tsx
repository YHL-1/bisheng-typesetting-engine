export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
};

type Props<T extends string> = {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label: string;
  small?: boolean;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  small = false,
}: Props<T>) {
  return (
    <div className={`segmented${small ? " seg-sm" : ""}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? "on" : undefined}
          disabled={option.disabled}
          title={option.title}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
