import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { TextField, TextareaField } from "@/components/ui/Field";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** alertdialog para confirmaciones que interrumpen. */
  role?: "dialog" | "alertdialog";
  initialFocusRef?: RefObject<HTMLElement>;
  /** Cerrar al hacer click en el fondo (por defecto sí). */
  closeOnOverlay?: boolean;
  hideCloseButton?: boolean;
  className?: string;
};

/** Diálogo modal centrado. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  role = "dialog",
  initialFocusRef,
  closeOnOverlay = true,
  hideCloseButton = false,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogFocus({ open, containerRef: panelRef, initialFocusRef, onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div
      className="ui-overlay ui-overlay--modal"
      onMouseDown={(event) => closeOnOverlay && event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-ui-dialog=""
        className={cx("ui-modal", `ui-modal--${size}`, className)}
      >
        <header className="ui-modal__header">
          <h2 id={titleId} className="ui-modal__title">{title}</h2>
          {!hideCloseButton ? (
            <button type="button" className="ui-dialog-close" onClick={onClose} aria-label="Cerrar">
              <AppIcon name="close" />
            </button>
          ) : null}
        </header>
        {description ? <div id={descriptionId} className="ui-modal__description">{description}</div> : null}
        {children ? <div className="ui-modal__body" data-dialog-body="">{children}</div> : null}
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  /** Consecuencia de confirmar, dicha con claridad. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Texto que hay que tipear para habilitar la confirmación (ej.: "ANULAR"). */
  requireText?: string;
  /** Pide un texto (reemplazo de window.prompt). */
  input?: {
    label: string;
    hint?: string;
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
    multiline?: boolean;
  };
  /** Puede ser async: el botón muestra carga hasta que termine. */
  onConfirm: (value?: string) => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  requireText,
  input,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [value, setValue] = useState(input?.defaultValue ?? "");
  const [pending, setPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setValue(input?.defaultValue ?? "");
      setPending(false);
    }
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const textMatches = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  const valueOk = !input?.required || value.trim().length > 0;
  const canConfirm = textMatches && valueOk && !pending;
  // Acciones peligrosas arrancan con el foco en Cancelar; si hay que escribir, en el campo.
  const initialFocusRef = requireText || input ? fieldRef : tone === "danger" ? cancelRef : confirmRef;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canConfirm) return;
    try {
      setPending(true);
      await onConfirm(input ? value : undefined);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onCancel()}
      title={title}
      description={description}
      role="alertdialog"
      initialFocusRef={initialFocusRef as RefObject<HTMLElement>}
      closeOnOverlay={!requireText && !input}
      className={cx("ui-confirm", tone === "danger" && "ui-confirm--danger")}
    >
      <form className="ui-confirm__form" onSubmit={handleSubmit} noValidate>
        {input ? (
          input.multiline ? (
            <TextareaField
              ref={fieldRef}
              label={input.label}
              hint={input.hint}
              placeholder={input.placeholder}
              required={input.required}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={3}
            />
          ) : (
            <TextField
              ref={fieldRef}
              label={input.label}
              hint={input.hint}
              placeholder={input.placeholder}
              required={input.required}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )
        ) : null}
        {requireText ? (
          <TextField
            ref={input ? undefined : fieldRef}
            label={
              <>
                Para confirmar, escribí <span className="ui-confirm__keyword">{requireText}</span>
              </>
            }
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        ) : null}
        <div className="ui-confirm__actions">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="submit"
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={!canConfirm && !pending}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
