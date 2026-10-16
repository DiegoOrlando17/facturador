import { cx } from "@/components/ui/cx";
import { formatComprobanteNumber, formatCuit, parseComprobanteNumber } from "@/lib/fiscalLabels";
import { getCurrencyFormatter, toAmount } from "@/lib/formatters";

type MoneyProps = {
  value: number | string | null | undefined;
  currency?: string | null;
  decimals?: number;
  /** "always" muestra el + en positivos (diferencias, saldos). */
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
  /** Colorea según el signo (verde positivo, rojo negativo). */
  colorBySign?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Atenúa los centavos (por defecto en tamaños lg/xl). */
  dimCents?: boolean;
  /** Texto si no hay valor; sin esto, null se muestra como $ 0,00. */
  fallback?: string;
  className?: string;
};

/** Importe con cifras tabulares en monoespaciada. ARS con 2 decimales por defecto. */
export function Money({
  value,
  currency = "ARS",
  decimals = 2,
  signDisplay = "auto",
  colorBySign = false,
  size = "md",
  dimCents,
  fallback,
  className,
}: MoneyProps) {
  if ((value === null || value === undefined || value === "") && fallback !== undefined) {
    return <span className={cx("ui-money", "ui-money--empty", `ui-money--${size}`, className)}>{fallback}</span>;
  }
  const amount = toAmount(value);
  const formatter = getCurrencyFormatter(currency, { decimals, signDisplay });
  const parts = formatter.formatToParts(amount);
  const shouldDim = dimCents ?? (size === "lg" || size === "xl");
  const fractionIndex = parts.findIndex((part) => part.type === "decimal");
  const main = (fractionIndex >= 0 ? parts.slice(0, fractionIndex) : parts).map((part) => part.value).join("");
  const cents = fractionIndex >= 0 ? parts.slice(fractionIndex).map((part) => part.value).join("") : "";

  return (
    <span
      className={cx(
        "ui-money",
        `ui-money--${size}`,
        colorBySign && amount > 0 && "ui-money--positive",
        colorBySign && amount < 0 && "ui-money--negative",
        className,
      )}
    >
      {main}
      {cents ? <span className={shouldDim ? "ui-money__cents" : undefined}>{cents}</span> : null}
    </span>
  );
}

type FiscalNumberProps = {
  /** cuit: 20-12345678-9 · cae: 14 dígitos · comprobante: 00001-00000042 · plain: tal cual. */
  kind: "cuit" | "cae" | "comprobante" | "plain";
  value?: string | number | null;
  /** Para `comprobante`: punto de venta y número por separado. */
  ptoVta?: string | number | null;
  number?: string | number | null;
  fallback?: string;
  className?: string;
};

/** Número fiscal en monoespaciada, formateado según su tipo. */
export function FiscalNumber({ kind, value, ptoVta, number, fallback = "Sin dato", className }: FiscalNumberProps) {
  let text: string;
  if (kind === "cuit") text = formatCuit(value, fallback);
  else if (kind === "comprobante") {
    text = number !== undefined && number !== null ? formatComprobanteNumber(ptoVta, number, fallback) : parseComprobanteNumber(value, fallback);
  } else text = value === null || value === undefined || value === "" ? fallback : String(value);

  const isEmpty = text === fallback;
  return <span className={cx("ui-fiscal", isEmpty && "ui-fiscal--empty", className)}>{text}</span>;
}
