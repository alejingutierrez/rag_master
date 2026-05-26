"use client";

import { cn } from "@/lib/cn";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  /** Tecla(s) a renderizar. Si es array, las une con `+`. */
  keys?: string | string[];
}

const SYMBOL_MAP: Record<string, string> = {
  cmd: "⌘",
  command: "⌘",
  ctrl: "Ctrl",
  shift: "⇧",
  alt: "⌥",
  opt: "⌥",
  option: "⌥",
  enter: "↵",
  return: "↵",
  escape: "Esc",
  esc: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  tab: "⇥",
  space: "␣",
  backspace: "⌫",
};

function renderKey(k: string): string {
  return SYMBOL_MAP[k.toLowerCase()] ?? k;
}

export function Kbd({ keys, className, children, ...props }: KbdProps) {
  const content = keys
    ? Array.isArray(keys)
      ? keys.map(renderKey).join(" + ")
      : renderKey(keys)
    : children;

  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "font-mono text-[10.5px] font-medium leading-none",
        "px-1.5 py-[3px]",
        "bg-[var(--bg-muted)] text-[var(--fg-muted)]",
        "border border-[var(--border-default)]",
        "rounded-sm",
        className,
      )}
      {...props}
    >
      {content}
    </kbd>
  );
}
