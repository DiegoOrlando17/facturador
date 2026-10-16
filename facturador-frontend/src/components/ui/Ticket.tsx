import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type TicketProps = {
  /** Bordes troquelados: arriba, abajo o ambos. */
  edges?: "both" | "top" | "bottom";
  /** Elemento superpuesto arriba a la derecha (típicamente un <Stamp />). */
  stamp?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
  padding?: "sm" | "md" | "lg";
  as?: "article" | "section" | "div";
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title">;

/**
 * Firma de marca: comprobante en papel con borde troquelado. Para resúmenes de
 * una factura emitida, el momento de éxito y la landing; no para cualquier tarjeta.
 */
export function Ticket({ edges = "both", stamp, eyebrow, title, padding = "md", as: Tag = "article", className, children, ...rest }: TicketProps) {
  return (
    <Tag className={cx("ui-ticket", className)} {...rest}>
      {/* La sombra va en un contenedor aparte: la máscara del papel recortaría su propio filter. */}
      <div className="ui-ticket__sheet">
        <div className={cx("ui-ticket__paper", `ui-ticket__paper--${edges}`, `ui-ticket__paper--pad-${padding}`)}>
          {eyebrow || title ? (
            <header className={cx("ui-ticket__header", stamp ? "ui-ticket__header--with-stamp" : null)}>
              {eyebrow ? <p className="ui-ticket__eyebrow">{eyebrow}</p> : null}
              {title ? <h3 className="ui-ticket__title">{title}</h3> : null}
            </header>
          ) : null}
          {children}
        </div>
      </div>
      {stamp ? <div className="ui-ticket__stamp">{stamp}</div> : null}
    </Tag>
  );
}

/** Línea punteada de corte entre secciones del ticket. */
export function TicketDivider() {
  return <hr className="ui-ticket__divider" />;
}

type TicketRowProps = {
  label: ReactNode;
  value: ReactNode;
  /** Fila destacada (total). */
  emphasis?: boolean;
  /**
   * Valor en monoespaciada (fechas, códigos en texto plano). Money y
   * FiscalNumber ya son mono; el texto común ("Consumidor final") va en sans.
   */
  mono?: boolean;
};

/** Fila "concepto ........ valor" del ticket. */
export function TicketRow({ label, value, emphasis = false, mono = false }: TicketRowProps) {
  return (
    <div className={cx("ui-ticket__row", emphasis && "ui-ticket__row--emphasis", mono && "ui-ticket__row--mono")}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Contenedor <dl> para TicketRow. */
export function TicketRows({ children }: { children: ReactNode }) {
  return <dl className="ui-ticket__rows">{children}</dl>;
}

type StampProps = {
  label?: string;
  /** Texto chico debajo (fecha, "ARCA"). */
  sublabel?: string;
  tone?: "success" | "danger";
  size?: "sm" | "md" | "lg";
  /** Animación de "sellado" al aparecer (respeta prefers-reduced-motion). */
  animate?: boolean;
  className?: string;
};

/** Sello circular "CAE OK", levemente inclinado. */
export function Stamp({ label = "CAE OK", sublabel, tone = "success", size = "md", animate = true, className }: StampProps) {
  return (
    <span
      className={cx("ui-stamp", `ui-stamp--${tone}`, `ui-stamp--${size}`, animate && "ui-stamp--animate", className)}
      role="img"
      aria-label={sublabel ? `${label}, ${sublabel}` : label}
      // Etiquetas largas ("ANULADA") achican la letra para no salirse del aro.
      style={{ "--_chars": Math.max(label.length, 1) } as CSSProperties}
    >
      <span className="ui-stamp__ring" aria-hidden="true">
        <span className="ui-stamp__label">{label}</span>
        {sublabel ? <span className="ui-stamp__sublabel">{sublabel}</span> : null}
      </span>
    </span>
  );
}
