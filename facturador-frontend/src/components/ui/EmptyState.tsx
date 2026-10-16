import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

type HeadingLevel = "h2" | "h3" | "h4" | "p";

/** Íconos genéricos de "comprobante" que se reemplazan por el ticket en blanco. */
const TICKET_ICONS = new Set<AppIconName>(["inbox", "receipt", "invoice"]);

/** Ticket en blanco: la ilustración por defecto de los vacíos. */
function EmptyTicketIllustration() {
  return (
    <svg className="ui-empty__ticket" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
      <path
        className="ui-empty__ticket-paper"
        d="M6 10 10.5 6 15 10l4.5-4L24 10l4.5-4L33 10l4.5-4L42 10v36l-4.5 4-4.5-4-4.5 4-4.5-4-4.5 4-4.5-4-4.5 4L6 46Z"
      />
      <path className="ui-empty__ticket-line" d="M13 20h22M13 27h13" />
      <path className="ui-empty__ticket-rule" d="M13 35h22" />
      <circle className="ui-empty__ticket-dot" cx="33" cy="41" r="3" />
    </svg>
  );
}

export type EmptyStateProps = {
  /** Ícono en lugar del ticket en blanco (por defecto se muestra el ticket). */
  icon?: AppIconName;
  title: ReactNode;
  /** Qué falta y cuál es el siguiente paso. */
  description?: ReactNode;
  action?: ReactNode;
  titleAs?: HeadingLevel;
  /** Versión compacta para tarjetas y celdas de tabla. */
  compact?: boolean;
  className?: string;
};

export function EmptyState({ icon, title, description, action, titleAs: Heading = "h3", compact = false, className }: EmptyStateProps) {
  return (
    <div className={cx("ui-empty", compact && "ui-empty--compact", className)}>
      {icon && !TICKET_ICONS.has(icon) ? (
        <span className="ui-empty__icon" aria-hidden="true">
          <AppIcon name={icon} />
        </span>
      ) : (
        <EmptyTicketIllustration />
      )}
      <Heading className="ui-empty__title">{title}</Heading>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

export type ErrorStateProps = {
  title?: ReactNode;
  /** Mensaje del error (ya en lenguaje del usuario). */
  message?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  titleAs?: HeadingLevel;
  compact?: boolean;
  className?: string;
};

/** Error de carga con Reintentar. Se anuncia con role="alert". */
export function ErrorState({
  title = "No pudimos cargar los datos.",
  message,
  onRetry,
  retrying = false,
  retryLabel = "Reintentar",
  titleAs: Heading = "h3",
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cx("ui-empty", "ui-empty--error", compact && "ui-empty--compact", className)} role="alert">
      <span className="ui-empty__icon" aria-hidden="true">
        <AppIcon name="alert-circle" />
      </span>
      <Heading className="ui-empty__title">{title}</Heading>
      {message ? <p className="ui-empty__description">{message}</p> : null}
      {onRetry ? (
        <div className="ui-empty__action">
          <Button variant="secondary" size="sm" iconLeft="refresh" onClick={onRetry} loading={retrying} loadingLabel="Reintentando…">
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
