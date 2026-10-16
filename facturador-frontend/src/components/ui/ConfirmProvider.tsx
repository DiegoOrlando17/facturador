import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmDialogProps } from "@/components/ui/Modal";

export type ConfirmOptions = Pick<ConfirmDialogProps, "title" | "description" | "confirmLabel" | "cancelLabel" | "tone" | "requireText">;
export type PromptOptions = ConfirmOptions & { input: NonNullable<ConfirmDialogProps["input"]> };

type PendingRequest =
  | { id: number; type: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { id: number; type: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/** Monta un único ConfirmDialog para toda la app y expone useConfirm/usePrompt. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const requestRef = useRef<PendingRequest | null>(null);
  const nextId = useRef(1);

  const settle = useCallback((result: boolean | string | null) => {
    const current = requestRef.current;
    if (!current) return;
    requestRef.current = null;
    setRequest(null);
    if (current.type === "confirm") current.resolve(Boolean(result));
    else current.resolve(typeof result === "string" ? result : null);
  }, []);

  const open = useCallback((next: PendingRequest) => {
    // Si había otro pedido abierto, se resuelve como cancelado.
    if (requestRef.current) settle(requestRef.current.type === "confirm" ? false : null);
    requestRef.current = next;
    setRequest(next);
  }, [settle]);

  const value = useMemo<ConfirmContextValue>(
    () => ({
      confirm: (options) => new Promise<boolean>((resolve) => open({ id: nextId.current++, type: "confirm", options, resolve })),
      prompt: (options) => new Promise<string | null>((resolve) => open({ id: nextId.current++, type: "prompt", options, resolve })),
    }),
    [open],
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        key={request?.id ?? 0}
        open={Boolean(request)}
        title={request?.options.title ?? ""}
        description={request?.options.description}
        confirmLabel={request?.options.confirmLabel}
        cancelLabel={request?.options.cancelLabel}
        tone={request?.options.tone}
        requireText={request?.options.requireText}
        input={request?.type === "prompt" ? request.options.input : undefined}
        onConfirm={(text) => settle(request?.type === "prompt" ? text ?? "" : true)}
        onCancel={() => settle(request?.type === "prompt" ? null : false)}
      />
    </ConfirmContext.Provider>
  );
}

function useConfirmContext() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm/usePrompt tienen que usarse dentro de <ConfirmProvider>.");
  return context;
}

/**
 * Reemplazo de window.confirm:
 * `if (await confirm({ title: "¿Anular la factura?", description: "...", tone: "danger", confirmLabel: "Anular" })) {...}`
 */
export function useConfirm() {
  return useConfirmContext().confirm;
}

/** Reemplazo de window.prompt: devuelve el texto o null si se canceló. */
export function usePrompt() {
  return useConfirmContext().prompt;
}
