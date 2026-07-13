"use client";

export type FilterOption<V extends string | number = string> =
  | V
  | { value: V; label: string };

export interface FilterTabsProps<V extends string | number = string> {
  value: V;
  options: ReadonlyArray<FilterOption<V>>;
  onChange: (v: V) => void;
}

export function FilterTabs<V extends string | number = string>({
  value,
  options,
  onChange,
}: FilterTabsProps<V>) {
  return (
    <div
      style={{
        display: "inline-flex",
        borderBottom: "1px solid var(--line)",
        gap: 0,
        flexWrap: "wrap",
      }}
    >
      {options.map((o) => {
        const k = typeof o === "object" && o !== null ? o.value : o;
        const lab = typeof o === "object" && o !== null ? o.label : String(o);
        const active = k === value;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            style={{
              appearance: "none",
              background: "transparent",
              border: 0,
              padding: "10px 18px",
              fontSize: 12.5,
              color: active ? "var(--fg)" : "var(--fg-muted)",
              fontFamily: "var(--font-sans)",
              fontWeight: active ? 500 : 400,
              cursor: "pointer",
              borderBottom: "2px solid " + (active ? "var(--fg)" : "transparent"),
              marginBottom: -1,
              letterSpacing: "-0.005em",
            }}
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}
