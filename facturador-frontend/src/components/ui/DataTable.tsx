import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState, type EmptyStateProps } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

/** Breakpoints del sistema: sm < 640px, md < 900px, lg < 1200px. */
export type Breakpoint = "sm" | "md" | "lg";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  /** Contenido de la celda. */
  cell: (row: T, index: number) => ReactNode;
  align?: "start" | "center" | "end";
  /** Ancho CSS de la columna ("12rem", "20%"). */
  width?: string;
  /** Oculta la columna por debajo de ese ancho (también en la vista de tarjetas). */
  hideBelow?: Breakpoint;
  /** Etiqueta en la vista de tarjetas (móvil). Por defecto, el header si es texto. */
  mobileLabel?: string;
  /**
   * Columna principal: en móvil encabeza la tarjeta sin etiqueta y, con
   * `getRowHref`, lleva el enlace de la fila. Por defecto, la primera columna.
   */
  primary?: boolean;
  /** Números: cifras tabulares y monoespaciadas. */
  numeric?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[] | null | undefined;
  getRowKey: (row: T, index: number) => string;
  /** Describe la tabla para lectores de pantalla. */
  caption: string;
  /** Muestra el caption también visualmente. */
  showCaption?: boolean;
  /** Primera carga: filas esqueleto. */
  isLoading?: boolean;
  /** Recarga con datos visibles: barra de progreso, sin desmontar filas. */
  isRefreshing?: boolean;
  skeletonRows?: number;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Estado vacío: props de EmptyState o un nodo propio. */
  empty?: Partial<EmptyStateProps> | ReactNode;
  stickyHeader?: boolean;
  /** Alto máximo del contenedor cuando `stickyHeader` está activo. */
  maxHeight?: CSSProperties["maxHeight"];
  /** Enlace de cada fila: la columna principal se vuelve un <Link> y la fila entera es clickeable. */
  getRowHref?: (row: T) => string | null | undefined;
  /** Acción al activar la fila (click, Enter o Espacio). Para navegar preferí `getRowHref`. */
  onRowClick?: (row: T) => void;
  /** Nombre accesible de la acción de fila (ej.: "Ver venta 123"). */
  getRowLabel?: (row: T) => string;
  density?: "comfortable" | "compact";
  className?: string;
};

const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='button'], [data-row-ignore]";

function isPlainObjectEmpty(value: unknown): value is Partial<EmptyStateProps> {
  return typeof value === "object" && value !== null && !("$$typeof" in (value as Record<string, unknown>)) && !Array.isArray(value);
}

/**
 * Tabla real (<table>) en escritorio; por debajo de 640px cada fila se muestra
 * como tarjeta con pares "etiqueta: valor". Maneja carga, vacío y error.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  showCaption = false,
  isLoading = false,
  isRefreshing = false,
  skeletonRows = 5,
  errorMessage,
  onRetry,
  empty,
  stickyHeader = false,
  maxHeight = "min(70vh, 640px)",
  getRowHref,
  onRowClick,
  getRowLabel,
  density = "comfortable",
  className,
}: DataTableProps<T>) {
  const navigate = useNavigate();
  const primaryIndex = Math.max(0, columns.findIndex((column) => column.primary));
  const hasRows = Boolean(rows && rows.length > 0);
  const showSkeleton = isLoading && !hasRows;
  const showError = !showSkeleton && Boolean(errorMessage) && !hasRows;
  const showEmpty = !showSkeleton && !showError && !hasRows;
  const isInteractive = Boolean(getRowHref || onRowClick);

  function columnClasses(column: DataTableColumn<T>, index: number) {
    return cx(
      column.align && column.align !== "start" && `ui-table__cell--${column.align}`,
      column.hideBelow && `ui-table__cell--hide-${column.hideBelow}`,
      column.numeric && "ui-table__cell--numeric",
      index === primaryIndex && "ui-table__cell--primary",
    );
  }

  function labelFor(column: DataTableColumn<T>) {
    if (column.mobileLabel) return column.mobileLabel;
    return typeof column.header === "string" ? column.header : "";
  }

  function activateRow(row: T, openInNewTab = false) {
    const href = getRowHref?.(row);
    if (href) {
      if (openInNewTab) window.open(href, "_blank", "noopener");
      else navigate(href);
      return;
    }
    onRowClick?.(row);
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    if (window.getSelection()?.toString()) return; // estaba seleccionando texto
    activateRow(row, event.metaKey || event.ctrlKey);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateRow(row);
    }
  }

  const colSpan = columns.length;
  const emptyNode = showEmpty
    ? isPlainObjectEmpty(empty) || empty === undefined
      ? (
        <EmptyState
          compact
          title={(empty as Partial<EmptyStateProps> | undefined)?.title ?? "No hay datos para mostrar."}
          {...(empty as Partial<EmptyStateProps> | undefined)}
        />
      )
      : empty
    : null;

  return (
    <div
      className={cx(
        "ui-table-wrap",
        stickyHeader && "ui-table-wrap--sticky",
        isRefreshing && "ui-table-wrap--refreshing",
        className,
      )}
      style={stickyHeader ? { maxHeight } : undefined}
    >
      {isRefreshing ? <span className="ui-table-wrap__progress" aria-hidden="true" /> : null}
      <table
        className={cx("ui-table", `ui-table--${density}`, isInteractive && "ui-table--interactive")}
        aria-busy={isLoading || isRefreshing || undefined}
      >
        <caption className={showCaption ? "ui-table__caption" : "ui-sr-only"}>{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column.id} scope="col" className={columnClasses(column, index)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeleton
            ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} className="ui-table__row ui-table__row--skeleton">
                {columns.map((column, index) => (
                  <td key={column.id} className={columnClasses(column, index)}>
                    <Skeleton width={index === primaryIndex ? "70%" : `${45 + ((rowIndex + index) % 3) * 15}%`} />
                  </td>
                ))}
              </tr>
            ))
            : null}

          {showError ? (
            <tr className="ui-table__row ui-table__row--state">
              <td colSpan={colSpan}>
                <ErrorState compact message={errorMessage} onRetry={onRetry} />
              </td>
            </tr>
          ) : null}

          {showEmpty ? (
            <tr className="ui-table__row ui-table__row--state">
              <td colSpan={colSpan}>{emptyNode}</td>
            </tr>
          ) : null}

          {hasRows
            ? rows!.map((row, rowIndex) => {
              const href = getRowHref?.(row) ?? null;
              const rowLabel = getRowLabel?.(row);
              const rowIsClickable = Boolean(href || onRowClick);
              const focusableRow = Boolean(onRowClick && !href);
              return (
                <tr
                  key={getRowKey(row, rowIndex)}
                  className={cx("ui-table__row", rowIsClickable && "ui-table__row--clickable")}
                  onClick={rowIsClickable ? (event) => handleRowClick(event, row) : undefined}
                  onKeyDown={focusableRow ? (event) => handleRowKeyDown(event, row) : undefined}
                  tabIndex={focusableRow ? 0 : undefined}
                  aria-label={focusableRow ? rowLabel : undefined}
                >
                  {columns.map((column, index) => {
                    const content = column.cell(row, rowIndex);
                    const label = labelFor(column);
                    return (
                      <td key={column.id} className={columnClasses(column, index)} data-label={label || undefined}>
                        {index === primaryIndex && href ? (
                          <Link to={href} className="ui-table__row-link" aria-label={rowLabel}>
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
            : null}
        </tbody>
      </table>
    </div>
  );
}
