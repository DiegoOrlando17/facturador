import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** Milisegundos. Por defecto 5 s (éxito/info) y 8 s (error). 0 = no se cierra solo. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastRecord = Required<Pick<ToastOptions, "tone" | "title">> & ToastOptions & { id: number };

type ShortcutOptions = Omit<ToastOptions, "tone" | "title">;

export type ToastApi = {
  show: (options: ToastOptions) => number;
  success: (title: string, options?: ShortcutOptions) => number;
  error: (title: string, options?: ShortcutOptions) => number;
  info: (title: string, options?: ShortcutOptions) => number;
  dismiss: (id: number) => void;
};

const MAX_TOASTS = 3;
const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICONS: Record<ToastTone, AppIconName> = {
  success: "check-circle",
  error: "alert-circle",
  info: "info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Las regiones aria-live existen siempre; se les cambia el texto para que se anuncie.
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const record: ToastRecord = { tone: "info", ...options, id };
    setToasts((current) => [...current, record].slice(-MAX_TOASTS));
    const announcement = [options.title, options.description].filter(Boolean).join(". ");
    if (record.tone === "error") {
      setAssertiveMessage("");
      window.setTimeout(() => setAssertiveMessage(announcement), 50);
    } else {
      setPoliteMessage("");
      window.setTimeout(() => setPoliteMessage(announcement), 50);
    }
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, options) => show({ ...options, title, tone: "success" }),
      error: (title, options) => show({ ...options, title, tone: "error" }),
      info: (title, options) => show({ ...options, title, tone: "info" }),
    }),
    [dismiss, show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <>
          <div className="ui-sr-only" aria-live="polite" aria-atomic="true">
            {politeMessage}
          </div>
          <div className="ui-sr-only" aria-live="assertive" aria-atomic="true">
            {assertiveMessage}
          </div>
          <section className="ui-toaster" aria-label="Notificaciones">
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </section>
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: number) => void }) {
  const duration = toast.duration ?? (toast.tone === "error" ? 8000 : 5000);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (duration <= 0 || paused) return undefined;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [duration, onDismiss, paused, toast.id]);

  return (
    <div
      className={cx("ui-toast", `ui-toast--${toast.tone}`)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="ui-toast__icon" aria-hidden="true">
        <AppIcon name={TONE_ICONS[toast.tone]} />
      </span>
      <div className="ui-toast__body">
        <p className="ui-toast__title">{toast.title}</p>
        {toast.description ? <p className="ui-toast__description">{toast.description}</p> : null}
        {toast.action ? (
          <button
            type="button"
            className="ui-toast__action"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className="ui-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Cerrar notificación">
        <AppIcon name="close" />
      </button>
    </div>
  );
}

/** `const toast = useToast(); toast.success("Listo, ya está facturado.")` */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast tiene que usarse dentro de <ToastProvider>.");
  return context;
}
