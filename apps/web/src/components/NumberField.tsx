import { clamp } from "../lib/math";

type Props = {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

export function NumberField({ label, value, unit, min, max, step, onChange }: Props) {
  const commit = (input: HTMLInputElement) => {
    const next = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(next)) {
      input.value = String(value);
      return;
    }
    const clamped = clamp(next, min, max);
    input.value = String(clamped);
    onChange(clamped);
  };

  return (
    <label className="field">
      <span className="k">{label}</span>
      <span className="v">
        <input
          // Remount when the value is changed from outside (reset or another
          // control), while leaving the user's in-progress edit untouched.
          key={value}
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          step={step}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}
