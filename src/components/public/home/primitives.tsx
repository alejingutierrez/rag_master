import type { ImageWidth } from "@/lib/image-url";
import { imageAt } from "@/lib/image-url";

const RESPONSIVE_IMAGE_WIDTHS: ImageWidth[] = [160, 320, 480, 640, 960, 1400];

export function EditorialArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className={`hc-arrow ${className}`}>
      <path d="M2.5 9h12M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function EditorialImage({
  src,
  alt,
  className = "",
  eager = false,
  width = 640,
  sizes,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  width?: ImageWidth;
  sizes?: string;
}) {
  if (!src) {
    return (
      <span
        className={`hc-image-fallback ${className}`}
        role={alt ? "img" : undefined}
        aria-label={alt ? `Sin imagen para ${alt}` : undefined}
        aria-hidden={alt ? undefined : true}
      >
        <i />
      </span>
    );
  }

  const responsive = src.startsWith("/api/public-image/");
  const widths = RESPONSIVE_IMAGE_WIDTHS.filter((candidate) => candidate <= width);
  const srcSet = responsive
    ? widths.map((candidate) => `${imageAt(src, candidate)} ${candidate}w`).join(", ")
    : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageAt(src, width)!}
      srcSet={srcSet}
      sizes={srcSet ? sizes ?? `${width}px` : undefined}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
    />
  );
}

export function SectionMark({
  number,
  eyebrow,
  title,
  description,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="hc-section-mark">
      <span className="hc-section-number">{number}</span>
      <div>
        <p className="hc-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="hc-section-dek">{description}</p> : null}
      </div>
    </header>
  );
}

export function formatEditorialNumber(value: number): string {
  return value.toLocaleString("es-CO");
}
