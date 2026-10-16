import { AppIcon } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";
import { formatNumber } from "@/lib/formatters";

type PageItem = number | "ellipsis-start" | "ellipsis-end";

/** Ventana de páginas alrededor de la actual: 1 … 4 5 [6] 7 8 … 20 */
export function getPageWindow(page: number, pageCount: number, siblings = 1): PageItem[] {
  if (pageCount <= 0) return [];
  const totalSlots = siblings * 2 + 5; // primera, última, actual, hermanos y dos elipsis
  if (pageCount <= totalSlots) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const showLeftEllipsis = left > 3;
  const showRightEllipsis = right < pageCount - 2;
  const edgeCount = 3 + siblings * 2;

  if (!showLeftEllipsis && showRightEllipsis) return [...range(1, edgeCount), "ellipsis-end", pageCount];
  if (showLeftEllipsis && !showRightEllipsis) return [1, "ellipsis-start", ...range(pageCount - edgeCount + 1, pageCount)];
  return [1, "ellipsis-start", ...range(left, right), "ellipsis-end", pageCount];
}

type PaginationProps = {
  /** Página actual (empieza en 1). */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Con ambos, muestra "21–40 de 132". */
  totalItems?: number;
  pageSize?: number;
  /** Nombre de lo que se pagina, en plural ("ventas"). */
  itemLabel?: string;
  siblings?: number;
  disabled?: boolean;
  className?: string;
};

export function Pagination({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
  itemLabel = "resultados",
  siblings = 1,
  disabled = false,
  className,
}: PaginationProps) {
  if (pageCount <= 1 && totalItems === undefined) return null;
  const current = Math.min(Math.max(1, page), Math.max(1, pageCount));
  const items = getPageWindow(current, pageCount, siblings);
  const rangeStart = totalItems !== undefined && pageSize ? Math.min(totalItems, (current - 1) * pageSize + 1) : null;
  const rangeEnd = totalItems !== undefined && pageSize ? Math.min(totalItems, current * pageSize) : null;

  return (
    <nav className={cx("ui-pagination", className)} aria-label="Paginación">
      {totalItems !== undefined && rangeStart !== null && rangeEnd !== null ? (
        <p className="ui-pagination__summary">
          {totalItems === 0 ? (
            `Sin ${itemLabel}`
          ) : (
            <>
              <strong>{formatNumber(rangeStart)}–{formatNumber(rangeEnd)}</strong> de {formatNumber(totalItems)} {itemLabel}
            </>
          )}
        </p>
      ) : null}
      {pageCount > 1 ? (
        <ul className="ui-pagination__list">
          <li>
            <button
              type="button"
              className="ui-pagination__step"
              onClick={() => onPageChange(current - 1)}
              disabled={disabled || current <= 1}
              aria-label="Página anterior"
            >
              <AppIcon name="chevron-left" />
              <span className="ui-pagination__step-text">Anterior</span>
            </button>
          </li>
          {items.map((item) =>
            typeof item === "number" ? (
              <li key={item}>
                <button
                  type="button"
                  className={cx("ui-pagination__page", item === current && "ui-pagination__page--current")}
                  onClick={() => onPageChange(item)}
                  disabled={disabled}
                  aria-label={`Página ${item}`}
                  aria-current={item === current ? "page" : undefined}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} className="ui-pagination__ellipsis" aria-hidden="true">
                …
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              className="ui-pagination__step"
              onClick={() => onPageChange(current + 1)}
              disabled={disabled || current >= pageCount}
              aria-label="Página siguiente"
            >
              <span className="ui-pagination__step-text">Siguiente</span>
              <AppIcon name="chevron-right" />
            </button>
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
