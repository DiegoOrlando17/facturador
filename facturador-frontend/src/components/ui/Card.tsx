import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/Skeleton";
import type { StatusTone } from "@/lib/statusLabels";

type HeadingLevel = "h2" | "h3" | "h4";

export type CardProps = {
  padding?: "none" | "sm" | "md" | "lg";
  title?: ReactNode;
  description?: ReactNode;
  /** Acciones a la derecha del encabezado (botones, enlaces). */
  actions?: ReactNode;
  titleAs?: HeadingLevel;
  /** Superficie: blanca (por defecto) o apagada para agrupar contenido secundario. */
  surface?: "default" | "muted";
  as?: "section" | "article" | "div";
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title">;

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { padding = "md", title, description, actions, titleAs: Heading = "h2", surface = "default", as: Tag = "section", className, children, ...rest },
  ref,
) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <Tag
      ref={ref as never}
      className={cx("ui-card", `ui-card--pad-${padding}`, surface === "muted" && "ui-card--muted", className)}
      {...rest}
    >
      {hasHeader ? (
        <header className="ui-card__header">
          <div className="ui-card__heading">
            {title ? <Heading className="ui-card__title">{title}</Heading> : null}
            {description ? <p className="ui-card__description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Tag>
  );
});

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  /** Texto chico debajo del valor: comparación, período, aclaración. */
  hint?: ReactNode;
  tone?: StatusTone;
  icon?: AppIconName;
  /** Ruta interna: toda la tarjeta pasa a ser un enlace. */
  to?: string;
  /** Nombre accesible del enlace si el texto visible no alcanza ("Ver ventas con error"). */
  linkLabel?: string;
  loading?: boolean;
  className?: string;
};

/** KPI: etiqueta, valor y aclaración. Con `to`, la tarjeta completa es clickeable. */
export function StatCard({ label, value, hint, tone = "neutral", icon, to, linkLabel, loading = false, className }: StatCardProps) {
  const classes = cx("ui-stat", `ui-stat--${tone}`, to && "ui-stat--link", className);
  const body = (
    <>
      <div className="ui-stat__top">
        <span className="ui-stat__label">{label}</span>
        {icon ? (
          <span className="ui-stat__icon" aria-hidden="true">
            <AppIcon name={icon} />
          </span>
        ) : null}
      </div>
      {loading ? (
        <>
          <Skeleton variant="block" width="55%" height="2rem" className="ui-stat__skeleton" />
          {hint !== undefined ? <Skeleton width="40%" /> : null}
          <span className="ui-sr-only">Cargando…</span>
        </>
      ) : (
        <>
          <span className="ui-stat__value">{value}</span>
          {hint ? <span className="ui-stat__hint">{hint}</span> : null}
        </>
      )}
      {to ? (
        <span className="ui-stat__arrow" aria-hidden="true">
          <AppIcon name="arrow-right" />
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={linkLabel} aria-busy={loading || undefined}>
        {body}
      </Link>
    );
  }
  return (
    <div className={classes} aria-busy={loading || undefined}>
      {body}
    </div>
  );
}

/** Alias con el nombre usado en el plan. */
export const KpiCard = StatCard;
