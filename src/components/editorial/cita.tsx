"use client";

export interface CitaProps {
  n: number;
  page?: number;
  doc?: string;
  onClick?: () => void;
}

/** Citation chip — footnote style. */
export function Cita({ n, page, doc, onClick }: CitaProps) {
  const title = doc && page ? `${doc} · p. ${page}` : doc ?? "";
  return (
    <a
      className="cita"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      title={title}
    >
      {n}
    </a>
  );
}
