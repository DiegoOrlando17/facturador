import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";
import { formatNumber } from "@/lib/formatters";

export type TabItem = {
  id: string;
  label: string;
  /** Contador al lado del texto (ej.: ventas con error). */
  count?: number | null;
  /** Resalta el contador cuando requiere atención. */
  countTone?: "neutral" | "warning" | "danger";
  icon?: AppIconName;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  /** Nombre accesible del grupo de pestañas. */
  label: string;
  /** Controlado. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /**
   * Sincroniza la pestaña activa con un parámetro de la URL (?tab=...).
   * La pestaña por defecto no se escribe en la URL.
   */
  paramName?: string;
  /** Contenido del panel activo. */
  children?: ReactNode | ((activeId: string) => ReactNode);
  className?: string;
  /**
   * underline: pestañas con subrayado de tinta (por defecto) · chips: píldoras
   * con borde de tinta y la activa rellena (filtros de listados).
   */
  variant?: "underline" | "chips";
  /** Clase del panel (por ejemplo para quitar el padding). */
  panelClassName?: string;
};

/**
 * Pestañas accesibles (tablist/tab/tabpanel) con activación automática:
 * ← → mueven y seleccionan, Inicio/Fin van a los extremos.
 */
export function Tabs({ items, label, value, defaultValue, onChange, paramName, children, className, panelClassName, variant = "underline" }: TabsProps) {
  const baseId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const enabledItems = items.filter((item) => !item.disabled);
  const fallbackId = defaultValue ?? enabledItems[0]?.id ?? items[0]?.id ?? "";
  const [internalValue, setInternalValue] = useState(fallbackId);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const paramValue = paramName ? searchParams.get(paramName) : null;
  const isValid = (id: string | null | undefined): id is string => Boolean(id && enabledItems.some((item) => item.id === id));
  const activeId = isValid(value) ? value : isValid(paramValue) ? paramValue : paramName ? fallbackId : isValid(internalValue) ? internalValue : fallbackId;

  function select(id: string) {
    if (id === activeId) return;
    if (value === undefined) setInternalValue(id);
    if (paramName) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id === fallbackId) next.delete(paramName);
          else next.set(paramName, id);
          return next;
        },
        { replace: true },
      );
    }
    onChange?.(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = enabledItems.findIndex((item) => item.id === activeId);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % enabledItems.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + enabledItems.length) % enabledItems.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = enabledItems.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = enabledItems[nextIndex];
    select(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;
  const content = typeof children === "function" ? children(activeId) : children;

  return (
    <div className={cx("ui-tabs", variant === "chips" && "ui-tabs--chips", className)}>
      <div className="ui-tabs__scroller">
        <div role="tablist" aria-label={label} className="ui-tabs__list">
          {items.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(item.id, node);
                  else tabRefs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={tabId(item.id)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                className={cx("ui-tabs__tab", selected && "ui-tabs__tab--selected")}
                onClick={() => select(item.id)}
                onKeyDown={handleKeyDown}
              >
                {item.icon ? <AppIcon name={item.icon} className="ui-tabs__icon" /> : null}
                <span>{item.label}</span>
                {item.count !== undefined && item.count !== null ? (
                  <span className={cx("ui-tabs__count", item.countTone && item.countTone !== "neutral" && `ui-tabs__count--${item.countTone}`)}>
                    {formatNumber(item.count)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {content !== undefined && content !== null ? (
        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabId(activeId)}
          tabIndex={0}
          className={cx("ui-tabs__panel", panelClassName)}
        >
          {content}
        </div>
      ) : null}
    </div>
  );
}
