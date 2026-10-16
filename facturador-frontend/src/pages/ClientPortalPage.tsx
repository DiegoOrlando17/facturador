import { Link } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/EmptyState";
import { FiscalNumber, Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stamp, Ticket, TicketDivider } from "@/components/ui/Ticket";
import { usePortalResource } from "@/hooks/usePortalResource";
import { ARGENTINA_TIMEZONE, formatNumber } from "@/lib/formatters";
import {
  formatShortDateTime,
  getInvoiceCustomerLabel,
  getInvoiceDisplayState,
  getInvoiceNumberLabel,
  type PortalInvoice,
} from "@/lib/portalInvoices";
import type { StatusTone } from "@/lib/statusLabels";

type AttentionCode =
  | "subscription_unpaid"
  | "invoices_failed"
  | "profile_rejected"
  | "invoices_pending_confirmation"
  | "profile_incomplete"
  | "mercadopago_not_connected"
  | "profile_in_review";

type HomeResponse = {
  month: {
    key: string;
    previousKey: string;
    currency: string;
    net: number;
    invoiceCount: number;
    averageTicket: number | null;
    previousNet: number;
    changePercent: number | null;
  };
  attention: { code: AttentionCode; tone: StatusTone; count: number | null; detail: string | null }[];
  profileStatus: string;
  subscription: { status: string; planName: string | null } | null;
  connection: { mercadoPagoConnected: boolean; invoiceMode: string; lastSyncAt: string | null; lastIssuedAt: string | null };
};

type InvoicesResponse = { items: PortalInvoice[] };

const BASE = "/portal-cliente";

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ARGENTINA_TIMEZONE });
const todayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: ARGENTINA_TIMEZONE });

function monthName(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
}

/** Texto y destino de cada ítem de "Qué hacer ahora". */
function describeAttention(item: HomeResponse["attention"][number]) {
  const count = item.count ?? 0;
  switch (item.code) {
    case "subscription_unpaid":
      return {
        title: item.detail === "CANCELED" ? "Tu plan no está activo" : "Tu plan tiene un pago pendiente",
        text: "Mientras el plan no esté al día no emitimos comprobantes.",
        to: `${BASE}/suscripcion`,
      };
    case "invoices_failed":
      return {
        title: count === 1 ? "Venta que ARCA rechazó" : "Ventas que ARCA rechazó",
        text: item.detail || "Revisá el motivo y la reintentamos.",
        to: `${BASE}/comprobantes?estado=con-error`,
      };
    case "profile_rejected":
      return { title: "Revisá tus datos fiscales", text: item.detail || "Hay algo para corregir antes de aprobarlos.", to: `${BASE}/perfil-fiscal` };
    case "invoices_pending_confirmation":
      return {
        title: count === 1 ? "Factura para confirmar" : "Facturas para confirmar",
        text: "Ventas esperando tu OK antes de emitir.",
        to: `${BASE}/comprobantes?estado=para-confirmar`,
      };
    case "profile_incomplete":
      return { title: "Completá tus datos fiscales", text: "Los necesitamos para emitir en ARCA.", to: `${BASE}/perfil-fiscal` };
    case "mercadopago_not_connected":
      return { title: "Conectá Mercado Pago", text: "Así leemos tus ventas y las facturamos.", to: `${BASE}/integraciones` };
    case "profile_in_review":
      return { title: "Tus datos fiscales están en revisión", text: "Te avisamos cuando estén aprobados.", to: null };
  }
}

function ChangeLine({ month }: { month: HomeResponse["month"] }) {
  const previous = monthName(month.previousKey);
  if (month.invoiceCount === 0 && month.net === 0) return <p className="portal-month__change">Todavía no emitiste facturas este mes.</p>;
  if (month.changePercent === null) return <p className="portal-month__change">Primer mes con facturas emitidas.</p>;
  if (month.changePercent === 0) return <p className="portal-month__change">Igual que en {previous} a esta altura.</p>;
  const up = month.changePercent > 0;
  return (
    <p className={`portal-month__change portal-month__change--${up ? "up" : "down"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {Math.abs(month.changePercent)} % {up ? "más" : "menos"} que en {previous} a esta altura
    </p>
  );
}

function MonthTicket({ home }: { home: HomeResponse }) {
  const { month } = home;
  const allClear = month.invoiceCount > 0 && !home.attention.some((item) => item.tone === "danger");
  return (
    <Ticket
      as="section"
      padding="lg"
      className="portal-month"
      aria-labelledby="portal-month-title"
      stamp={allClear ? <Stamp label="AL DÍA" sublabel="ARCA" size="sm" /> : undefined}
    >
      <p id="portal-month-title" className="portal-month__label">
        Facturado en {monthName(month.key)}
      </p>
      <p className="portal-month__amount">
        <Money value={month.net} currency={month.currency} size="xl" />
      </p>
      <ChangeLine month={month} />
      <TicketDivider />
      <div className="portal-month__stats">
        <span>
          <strong>{formatNumber(month.invoiceCount)}</strong> {month.invoiceCount === 1 ? "comprobante" : "comprobantes"}
        </span>
        {month.averageTicket !== null ? (
          <span>
            <strong>
              <Money value={month.averageTicket} currency={month.currency} />
            </strong>{" "}
            ticket promedio
          </span>
        ) : null}
      </div>
    </Ticket>
  );
}

function AttentionPanel({ home }: { home: HomeResponse }) {
  const done: string[] = [];
  if (home.profileStatus === "APPROVED") done.push("Datos fiscales aprobados");
  if (home.connection.mercadoPagoConnected) done.push("Mercado Pago conectado");
  if (home.subscription?.status === "ACTIVE") done.push(`Plan ${home.subscription.planName ?? ""} al día`.replace("  ", " "));

  return (
    <section className="portal-todo" aria-labelledby="portal-todo-title">
      <h2 id="portal-todo-title">Qué hacer ahora</h2>
      {home.attention.length === 0 ? <p className="portal-todo__empty">Nada pendiente. Seguí vendiendo.</p> : null}
      <ul className="portal-todo__list">
        {home.attention.map((item) => {
          const copy = describeAttention(item);
          const body = (
            <>
              {item.count ? <span className="portal-todo__count">{item.count}</span> : <AppIcon name={item.tone === "info" ? "clock" : "alert"} className="portal-todo__icon" />}
              <span className="portal-todo__text">
                <strong>{copy.title}</strong>
                <span>{copy.text}</span>
              </span>
              {copy.to ? <AppIcon name="arrow-right" className="portal-todo__arrow" /> : null}
            </>
          );
          return (
            <li key={item.code}>
              {copy.to ? (
                <Link to={copy.to} className={`portal-todo__item portal-todo__item--${item.tone}`}>
                  {body}
                </Link>
              ) : (
                <div className={`portal-todo__item portal-todo__item--${item.tone}`}>{body}</div>
              )}
            </li>
          );
        })}
        {done.map((text) => (
          <li key={text} className="portal-todo__done">
            <AppIcon name="check" /> {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConnectionPill({ connection }: { connection: HomeResponse["connection"] }) {
  if (!connection.mercadoPagoConnected) {
    return (
      <Link to={`${BASE}/integraciones`} className="portal-pill portal-pill--warning">
        <span className="portal-pill__dot" aria-hidden="true" />
        Mercado Pago sin conectar
      </Link>
    );
  }
  return (
    <span className="portal-pill portal-pill--success">
      <span className="portal-pill__dot" aria-hidden="true" />
      Todo conectado
      {connection.lastSyncAt ? ` · última lectura ${timeFormatter.format(new Date(connection.lastSyncAt))}` : ""}
    </span>
  );
}

const recentColumns: DataTableColumn<PortalInvoice>[] = [
  { id: "date", header: "Fecha", cell: (row) => <span className="portal-mono">{formatShortDateTime(row.issuedAt ?? row.createdAt)}</span>, width: "8rem" },
  {
    id: "number",
    header: "Comprobante",
    primary: true,
    cell: (row) => {
      const number = getInvoiceNumberLabel(row);
      return number ? <FiscalNumber kind="plain" value={number} /> : <span className="portal-muted">Sin emitir</span>;
    },
  },
  { id: "customer", header: "Cliente", cell: (row) => getInvoiceCustomerLabel(row), hideBelow: "md" },
  { id: "amount", header: "Importe", align: "end", numeric: true, cell: (row) => <Money value={row.amount} currency={row.currency ?? "ARS"} /> },
  {
    id: "status",
    header: "Estado",
    cell: (row) => {
      const state = getInvoiceDisplayState(row);
      return (
        <StatusBadge tone={state.tone} stamp={state.stamp}>
          {state.label}
        </StatusBadge>
      );
    },
  },
];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ClientPortalPage() {
  const { user } = useTenantAuth();
  const home = usePortalResource<HomeResponse>("/portal/home", { fallbackErrorMessage: "No pudimos cargar el inicio." });
  const recent = usePortalResource<InvoicesResponse>("/portal/invoices?pageSize=5&view=all", {
    fallbackErrorMessage: "No pudimos cargar las últimas facturas.",
  });
  const companyName = user?.tenant?.name ?? "";

  return (
    <div className="portal-page portal-home">
      <PageHeader
        eyebrow={capitalize(todayFormatter.format(new Date()))}
        title={companyName ? `Hola, ${companyName}.` : "Hola."}
        actions={home.data ? <ConnectionPill connection={home.data.connection} /> : null}
      />

      {home.errorMessage ? (
        <ErrorState title="No pudimos cargar el inicio." message={home.errorMessage} onRetry={() => void home.reload()} retrying={home.isRefreshing} />
      ) : home.data ? (
        <div className="portal-home__top">
          <MonthTicket home={home.data} />
          <AttentionPanel home={home.data} />
        </div>
      ) : (
        <div className="portal-home__top" aria-busy="true">
          <Skeleton variant="block" height="15rem" />
          <Skeleton variant="block" height="15rem" />
        </div>
      )}

      <section className="portal-section" aria-labelledby="portal-recent-title">
        <div className="portal-section__header">
          <h2 id="portal-recent-title">Últimas facturas</h2>
          <ButtonLink to={`${BASE}/comprobantes`} variant="link">
            Ver todas
          </ButtonLink>
        </div>
        <DataTable
          caption="Últimas facturas"
          columns={recentColumns}
          rows={recent.data?.items}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `${BASE}/comprobantes/${row.id}`}
          getRowLabel={(row) => `Ver factura ${getInvoiceNumberLabel(row) ?? "sin emitir"}`}
          isLoading={recent.isLoading}
          errorMessage={recent.errorMessage}
          onRetry={() => void recent.reload()}
          skeletonRows={5}
          empty={{ title: "Todavía no hay facturas", description: "Cuando entren ventas de Mercado Pago las vas a ver acá." }}
        />
      </section>
    </div>
  );
}
