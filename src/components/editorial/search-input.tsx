"use client";

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  width = 280,
}: SearchInputProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid var(--line-strong)",
        padding: "7px 0",
        width,
      }}
    >
      <span
        style={{
          color: "var(--fg-faint)",
          fontFamily: "var(--font-mono)",
          fontSize: 14,
        }}
      >
        ⌕
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          appearance: "none",
          background: "transparent",
          border: 0,
          outline: "none",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          color: "var(--fg)",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            padding: 0,
            color: "var(--fg-faint)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
