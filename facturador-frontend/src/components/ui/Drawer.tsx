import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Barra inferior fija (Guardar / Cancelar). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /**
   * Hay cambios sin guardar: Escape, el fondo o la × piden confirmación
   * dentro del panel en lugar de cerrar.
   */
  dirty?: boolean;
  dirtyMessage?: string;
  /** Elemento que recibe el foco al abrir (por defecto, el primero enfocable). */
  initialFocusRef?: RefObject<HTMLElement>;
  className?: string;
};

/** Panel lateral modal (role="dialog"): trampa de foco, Escape y devolución del foco. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dirty = false,
  dirtyMessage = "Tenés cambios sin guardar. ¿Querés descartarlos?",
  initialFocusRef,
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    if (!open) setConfirmingDiscard(false);
  }, [open]);

  useEffect(() => {
    if (confirmingDiscard) keepEditingRef.current?.focus();
  }, [confirmingDiscard]);

  function requestClose() {
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  useDialogFocus({ open, containerRef: panelRef, initialFocusRef, onEscape: requestClose });

  if (!open) return null;

  return createPortal(
    <div className="ui-overlay ui-overlay--drawer" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-ui-dialog=""
        className={cx("ui-drawer", `ui-drawer--${size}`, className)}
      >
        <header className="ui-drawer__header">
          <div>
            <h2 id={titleId} className="ui-drawer__title">{title}</h2>
            {description ? <p id={descriptionId} className="ui-drawer__description">{description}</p> : null}
          </div>
          <button type="button" className="ui-dialog-close" onClick={requestClose} aria-label="Cerrar panel">
            <AppIcon name="close" />
          </button>
        </header>

        {confirmingDiscard ? (
          <div className="ui-drawer__discard" role="alert">
            <p>{dirtyMessage}</p>
            <div className="ui-drawer__discard-actions">
              <Button ref={keepEditingRef} size="sm" variant="secondary" onClick={() => setConfirmingDiscard(false)}>
                Seguir editando
              </Button>
              <Button size="sm" variant="danger" onClick={onClose}>
                Descartar cambios
              </Button>
            </div>
          </div>
        ) : null}

        <div className="ui-drawer__body" data-dialog-body="">{children}</div>
        {footer ? <footer className="ui-drawer__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
