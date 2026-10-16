import { BRAND } from "@/config/brand";
import { cx } from "@/components/ui/cx";

type BrandMarkProps = {
  /** full: logo + nombre · mark: solo el logo. */
  variant?: "full" | "mark";
  /** inverse: sobre fondos oscuros (ticket de papel sobre tinta). */
  tone?: "default" | "inverse";
  size?: "sm" | "md" | "lg";
  /** Línea secundaria: "Panel interno", "Portal del cliente". */
  subtitle?: string;
  className?: string;
};

/**
 * Logo: ticket de tinta con el borde superior troquelado, renglones de papel y
 * el punto terracota del mostrador. No lleva letras: el nombre todavía no es
 * definitivo. Misma figura que /favicon.svg.
 */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg className={cx("ui-brand__glyph", className)} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="ui-brand__glyph-ticket" d="M3 8.5 6.25 4.5 9.5 8.5l3.25-4L16 8.5l3.25-4 3.25 4 3.25-4L29 8.5V29H3Z" />
      <path className="ui-brand__glyph-lines" d="M8 14h15M8 20h8" />
      <circle className="ui-brand__glyph-dot" cx="24.5" cy="24.5" r="5" />
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
