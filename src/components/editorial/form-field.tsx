"use client";

import type { ChangeEvent } from "react";

export interface FormFieldProps {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
}

export function FormField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  defaultValue,
  rows = 4,
}: FormFieldProps) {
  const sharedStyle = {
    width: "100%",
    appearance: "none" as const,
    background: "transparent",
    border: 0,
    borderBottom: "1px solid var(--line-strong)",
    padding: "8px 0",
    fontFamily: multiline ? "var(--font-display)" : "var(--font-sans)",
    fontSize: multiline ? 16 : 14,
    color: "var(--fg)",
    outline: "none",
    resize: multiline ? ("vertical" as const) : ("none" as const),
    lineHeight: multiline ? 1.55 : 1.4,
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label className="label" style={{ display: "block", marginBottom: 8 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          defaultValue={defaultValue}
          onChange={onChange ? handleChange : undefined}
          rows={rows}
          placeholder={placeholder}
          style={sharedStyle}
        />
      ) : (
        <input
          value={value}
          defaultValue={defaultValue}
          onChange={onChange ? handleChange : undefined}
          placeholder={placeholder}
          style={sharedStyle}
        />
      )}
    </div>
  );
}
