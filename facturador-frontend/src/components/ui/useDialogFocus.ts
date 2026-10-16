import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hasAttribute("inert") && element.getClientRects().length > 0,
  );
}

let openDialogs = 0;
let previousOverflow = "";

type DialogFocusOptions = {
  open: boolean;
  containerRef: RefObject<HTMLElement>;
  /** Elemento que recibe el foco al abrir. Sin valor: el primer elemento enfocable. */
  initialFocusRef?: RefObject<HTMLElement>;
  onEscape: () => void;
};

/**
 * Comportamiento común de diálogos modales: foco inicial, trampa de foco con Tab,
 * Escape, bloqueo del scroll del body y devolución del foco al cerrar.
 */
export function useDialogFocus({ open, containerRef, initialFocusRef, onEscape }: DialogFocusOptions) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!open) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (openDialogs === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs += 1;

    // Prioridad: ref explícita → [data-autofocus] → primer control del cuerpo → primer enfocable → el diálogo.
    const body = container.querySelector<HTMLElement>("[data-dialog-body]");
    const focusTarget =
      initialFocusRef?.current ??
      container.querySelector<HTMLElement>("[data-autofocus]") ??
      (body ? getFocusableElements(body)[0] : undefined) ??
      getFocusableElements(container)[0] ??
      container;
    focusTarget.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (!container) return;
      // Solo el diálogo de más arriba reacciona (por ejemplo un confirm sobre un drawer).
      const dialogs = document.querySelectorAll("[data-ui-dialog]");
      if (dialogs[dialogs.length - 1] !== container) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      openDialogs = Math.max(0, openDialogs - 1);
      if (openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus({ preventScroll: true });
    };
    // initialFocusRef es una ref estable; solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, containerRef]);
}
