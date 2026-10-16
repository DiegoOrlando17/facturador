import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

type HeadingLevel = "h2" | "h3" | "h4" | "p";

export type EmptyStateProps = {
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

export function EmptyState({ icon = "inbox", title, description, action, titleAs: Heading = "h3", compact = false, className }: EmptyStateProps) {
  return (
    <div className={cx("ui-empty", compact && "ui-empty--compact", className)}>
      <span className="ui-empty__icon" aria-hidden="true">
        <AppIcon name={icon} />
      </span>
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
