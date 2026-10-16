import { BRAND } from "@/config/brand";
import { cx } from "@/components/ui/cx";

type BrandMarkProps = {
  /** full: logo + nombre · mark: solo el logo. */
  variant?: "full" | "mark";
  /** inverse: sobre fondos oscuros. */
  tone?: "default" | "inverse";
  size?: "sm" | "md" | "lg";
  /** Línea secundaria: "Panel interno", "Portal del cliente". */
  subtitle?: string;
  className?: string;
};

/** Logo: ticket troquelado con el sello verde (misma figura que /favicon.svg). */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg className={cx("ui-brand__glyph", className)} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect className="ui-brand__glyph-bg" width="32" height="32" rx="7" />
      <path
        className="ui-brand__glyph-paper"
        d="M7 9.5 9 7.5l2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V25a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 7 25Z"
      />
      <rect className="ui-brand__glyph-line" x="10" y="13" width="10" height="2" rx="1" />
      <rect className="ui-brand__glyph-line" x="10" y="17.5" width="6" height="2" rx="1" />
      <circle className="ui-brand__glyph-stamp" cx="22.5" cy="22.5" r="6" />
      <path className="ui-brand__glyph-check" d="m19.8 22.7 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

/** Marca del producto. El nombre sale de BRAND (config/brand.ts). */
export function BrandMark({ variant = "full", tone = "default", size = "md", subtitle, className }: BrandMarkProps) {
  const classes = cx("ui-brand", `ui-brand--${tone}`, `ui-brand--${size}`, className);

  if (variant === "mark") {
    return (
      <span className={classes} role="img" aria-label={BRAND.name}>
        <BrandGlyph />
      </span>
    );
  }

  return (
    <span className={classes}>
      <BrandGlyph />
      <span className="ui-brand__text">
        <span className="ui-brand__name">{BRAND.name}</span>
        {subtitle ? <span className="ui-brand__subtitle">{subtitle}</span> : null}
      </span>
    </span>
  );
}
