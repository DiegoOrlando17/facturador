import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  Button,
  ButtonLink,
  Callout,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FiscalNumber,
  Modal,
  Money,
  PageHeader,
  Pagination,
  PasswordField,
  SelectField,
  Skeleton,
  Stamp,
  StatCard,
  StatusBadge,
  Tabs,
  TextareaField,
  TextField,
  Ticket,
  TicketDivider,
  TicketRow,
  TicketRows,
  useConfirm,
  usePrompt,
  useToast,
  type ButtonVariant,
  type DataTableColumn,
} from "@/components/ui";
import { getComprobanteTypeLabel, getPaymentMethodLabel } from "@/lib/fiscalLabels";
import { formatArgentinaDateTime } from "@/lib/formatters";
import { STATUS_KINDS, type StatusKind, type StatusTone } from "@/lib/statusLabels";

type DemoSale = {
  id: string;
  date: string;
  customer: string;
  method: string;
  cbteTipo: number;
  ptoVta: number;
  cbteNro: number | null;
  amount: number;
  status: string;
};

const DEMO_SALES: DemoSale[] = [
  { id: "s1", date: "2026-10-15T13:42:00Z", customer: "Consumidor final", method: "debit_card", cbteTipo: 11, ptoVta: 3, cbteNro: 1842, amount: 18450.5, status: "complete" },
  { id: "s2", date: "2026-10-15T13:10:00Z", customer: "Almacén Don Pepe SRL", method: "account_money", cbteTipo: 11, ptoVta: 3, cbteNro: 1841, amount: 96200, status: "sheets_pending" },
  { id: "s3", date: "2026-10-15T12:55:00Z", customer: "Consumidor final", method: "credit_card", cbteTipo: 11, ptoVta: 3, cbteNro: null, amount: 3250.75, status: "afip_pending" },
  { id: "s4", date: "2026-10-15T12:31:00Z", customer: "María Fernández", method: "master", cbteTipo: 11, ptoVta: 3, cbteNro: null, amount: 12000, status: "failed" },
  { id: "s5", date: "2026-10-15T12:02:00Z", customer: "Consumidor final", method: "qr", cbteTipo: 11, ptoVta: 3, cbteNro: null, amount: 845, status: "processing" },
];

const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger", "danger-soft", "link"];
const TONES: StatusTone[] = ["success", "warning", "danger", "info", "neutral"];
const KIND_TITLES: Record<StatusKind, string> = {
  payment: "Ventas (Payment.status)",
  paymentEvent: "Eventos de venta",
  invoice: "Comprobantes (Invoice.status)",
  invoiceSource: "Origen del comprobante",
  invoiceType: "Tipo de comprobante",
  invoiceEvent: "Eventos de comprobante",
  onboarding: "Puesta en marcha",
  tenantReadiness: "Estado operativo de la empresa",
  fiscalProfile: "Datos fiscales",
  subscription: "Suscripción",
  billing: "Débito automático",
  tenant: "Empresa",
  userStatus: "Usuario",
  integrationHealth: "Integraciones",
  adminRole: "Rol de admin",
  tenantUserRole: "Rol en la empresa",
  auditAction: "Acciones de auditoría",
};
const KINDS_TO_SHOW: StatusKind[] = ["payment", "invoice", "subscription", "billing", "fiscalProfile", "onboarding", "tenantReadiness", "integrationHealth", "tenantUserRole", "auditAction"];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="catalog-section" aria-labelledby={`catalog-${id}`}>
      <header className="catalog-section__header">
        <h2 id={`catalog-${id}`}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Specimen({ label, children, dark = false }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={`catalog-specimen${dark ? " catalog-specimen--dark" : ""}`}>
      <span className="catalog-specimen__label">{label}</span>
      <div className="catalog-specimen__body">{children}</div>
    </div>
  );
}

export function ComponentCatalogPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [page, setPage] = useState(6);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerNote, setDrawerNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [lastResult, setLastResult] = useState("Todavía no confirmaste nada.");

  const columns: DataTableColumn<DemoSale>[] = [
    {
      id: "date",
      header: "Fecha",
      primary: true,
      cell: (row) => formatArgentinaDateTime(row.date),
    },
    { id: "customer", header: "Cliente", cell: (row) => row.customer, hideBelow: "md" },
    { id: "method", header: "Medio de pago", cell: (row) => getPaymentMethodLabel(row.method), hideBelow: "lg" },
    {
      id: "cbte",
      header: "Comprobante",
      cell: (row) =>
        row.cbteNro ? (
          <span className="catalog-cbte">
            <span>{getComprobanteTypeLabel(row.cbteTipo)}</span>
            <FiscalNumber kind="comprobante" ptoVta={row.ptoVta} number={row.cbteNro} />
          </span>
        ) : (
          <span className="catalog-muted">Sin emitir</span>
        ),
    },
    { id: "amount", header: "Importe", align: "end", numeric: true, cell: (row) => <Money value={row.amount} /> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge kind="payment" value={row.status} dot /> },
  ];

  async function runConfirm() {
    const ok = await confirm({
      title: "¿Reprocesar la venta?",
      description: "Vamos a volver a intentar el paso que falló. Si la factura ya está emitida, no se emite de nuevo.",
      confirmLabel: "Reprocesar",
    });
    setLastResult(ok ? "Confirmaste el reproceso." : "Cancelaste el reproceso.");
    if (ok) toast.success("Listo, reproceso pedido.", { description: "Te avisamos cuando termine." });
  }

  async function runDangerConfirm() {
    const ok = await confirm({
      title: "¿Anular la factura 00003-00001842?",
      description: "Se va a emitir una nota de crédito C por $ 18.450,50 en ARCA. No se puede deshacer.",
      confirmLabel: "Anular factura",
      tone: "danger",
      requireText: "ANULAR",
    });
    setLastResult(ok ? "Confirmaste la anulación (demo, no se emitió nada)." : "Cancelaste la anulación.");
  }

  async function runPrompt() {
    const note = await prompt({
      title: "Agregar nota",
      description: "La nota queda en el historial de la empresa y la ve todo el equipo interno.",
      confirmLabel: "Guardar nota",
      input: { label: "Nota", placeholder: "Ej.: llamó por el certificado", required: true, multiline: true },
    });
    setLastResult(note === null ? "Cancelaste la nota." : `Nota: “${note}”`);
  }

  function runLoadingDemo() {
    setLoadingDemo(true);
    window.setTimeout(() => setLoadingDemo(false), 1800);
  }

  return (
    <main className="catalog-page">
      <PageHeader
        title="Catálogo de componentes"
        description="Referencia viva del sistema de diseño: cada componente compartido en todas sus variantes. Usalo para revisar cambios visuales antes de migrar pantallas."
        breadcrumb={[{ label: "Inicio", to: "/admin" }, { label: "Sistema de diseño" }, { label: "Catálogo" }]}
        meta={
          <>
            <span>Fase 2 · componentes compartidos</span>
            <StatusBadge tone="info" dot>Interno</StatusBadge>
          </>
        }
        actions={
          <>
            <ButtonLink to="/admin" variant="secondary" iconLeft="home">Volver al panel</ButtonLink>
            <Button variant="primary" iconLeft="check" onClick={() => toast.success("Listo, ya está facturado.")}>Probar toast</Button>
          </>
        }
      />

      <nav className="catalog-toc" aria-label="Secciones del catálogo">
        {[
          ["marca", "Marca"],
          ["botones", "Botones"],
          ["estados", "Estados"],
          ["tarjetas", "Tarjetas"],
          ["pestanas", "Pestañas"],
          ["tablas", "Tablas"],
          ["formularios", "Formularios"],
          ["numeros", "Importes y números"],
          ["firma", "Ticket y sello"],
          ["feedback", "Avisos y vacíos"],
          ["capas", "Diálogos y toasts"],
        ].map(([id, label]) => (
          <a key={id} href={`#catalog-${id}`}>{label}</a>
        ))}
      </nav>

      <Section id="marca" title="Marca" description="El nombre sale de config/brand.ts: cambiarlo es una línea.">
        <div className="catalog-grid catalog-grid--3">
          <Specimen label="full · default">
            <BrandMark subtitle="Panel interno" />
          </Specimen>
          <Specimen label="full · inverse" dark>
            <BrandMark tone="inverse" subtitle="Portal del cliente" />
          </Specimen>
          <Specimen label="mark · sm / md / lg">
            <div className="catalog-row">
              <BrandMark variant="mark" size="sm" />
              <BrandMark variant="mark" />
              <BrandMark variant="mark" size="lg" />
              <img src="/favicon.svg" width={16} height={16} alt="Favicon a 16 px" />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="botones" title="Botones" description="Un único botón con variantes. Navegar = ButtonLink (semántica de enlace).">
        <div className="catalog-stack">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Specimen key={size} label={`Tamaño ${size}`}>
              <div className="catalog-row">
                {BUTTON_VARIANTS.map((variant) => (
                  <Button key={variant} variant={variant} size={size}>
                    {variant === "danger-soft" ? "Anular" : variant === "danger" ? "Eliminar" : variant === "link" ? "Ver detalle" : variant === "primary" ? "Guardar cambios" : variant === "ghost" ? "Cancelar" : "Exportar"}
                  </Button>
                ))}
              </div>
            </Specimen>
          ))}
          <Specimen label="Íconos, carga, deshabilitado, solo ícono">
            <div className="catalog-row">
              <Button variant="primary" iconLeft="plus">Nueva factura</Button>
              <Button iconRight="arrow-right">Siguiente</Button>
              <Button variant="primary" loading={loadingDemo} onClick={runLoadingDemo} loadingLabel="Emitiendo…">
                Emitir en ARCA
              </Button>
              <Button loading>Guardando</Button>
              <Button disabled>Deshabilitado</Button>
              <Button variant="ghost" iconOnly iconLeft="refresh" aria-label="Actualizar" />
              <Button variant="secondary" iconOnly iconLeft="download" aria-label="Descargar PDF" size="sm" />
              <ButtonLink href="https://www.arca.gob.ar" external variant="link">Ir a ARCA</ButtonLink>
            </div>
          </Specimen>
          <Specimen label="fullWidth">
            <div className="catalog-narrow">
              <Button variant="primary" size="lg" fullWidth>Ingresar</Button>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="estados" title="Estados" description="Un solo badge. Con kind/value, la etiqueta y el tono salen de lib/statusLabels (pasá el mouse para ver la descripción).">
        <div className="catalog-stack">
          <Specimen label="Tonos · sm / md / con punto">
            <div className="catalog-row">
              {TONES.map((tone) => (
                <StatusBadge key={tone} tone={tone}>{tone}</StatusBadge>
              ))}
            </div>
            <div className="catalog-row">
              {TONES.map((tone) => (
                <StatusBadge key={tone} tone={tone} size="md" dot>{tone}</StatusBadge>
              ))}
            </div>
          </Specimen>
          <div className="catalog-grid catalog-grid--2">
            {KINDS_TO_SHOW.map((kind) => (
              <Specimen key={kind} label={`kind="${kind}" · ${KIND_TITLES[kind]}`}>
                <div className="catalog-row catalog-row--tight">
                  {Object.keys(STATUS_KINDS[kind])
                    .filter((value) => value !== "canceled")
                    .map((value) => (
                      <StatusBadge key={value} kind={kind} value={value} dot={kind === "payment" || kind === "invoice"} />
                    ))}
                  <StatusBadge kind={kind} value="valor_desconocido" />
                </div>
              </Specimen>
            ))}
          </div>
        </div>
      </Section>

      <Section id="tarjetas" title="Tarjetas y KPIs">
        <div className="catalog-grid catalog-grid--4">
          <StatCard label="Facturado hoy" value={<Money value={1284500.4} />} hint="42 comprobantes" icon="receipt" tone="success" />
          <StatCard label="Por revisar" value="3" hint="Ventas con error" icon="alert" tone="danger" to="/admin/ui#catalog-tablas" linkLabel="Ver las 3 ventas por revisar" />
          <StatCard label="Esperando a ARCA" value="7" hint="Se reintentan solas" icon="clock" tone="warning" />
          <StatCard label="Ticket promedio" value="" hint="Últimos 30 días" icon="money" loading />
        </div>
        <div className="catalog-grid catalog-grid--2">
          <Card
            title="Datos fiscales"
            description="Así figura la empresa en los comprobantes."
            actions={<Button size="sm" iconLeft="settings">Editar</Button>}
          >
            <dl className="catalog-dl">
              <dt>Razón social</dt>
              <dd>Kiosco Auditoría SRL</dd>
              <dt>CUIT</dt>
              <dd><FiscalNumber kind="cuit" value="30712345678" /></dd>
              <dt>Condición frente al IVA</dt>
              <dd>Monotributista</dd>
            </dl>
          </Card>
          <Card padding="sm" surface="muted" title="Card muted · padding sm" titleAs="h3">
            <p className="catalog-muted">Para agrupar información secundaria dentro de otra tarjeta o al costado.</p>
          </Card>
        </div>
      </Section>

      <Section id="pestanas" title="Pestañas" description="Sincronizadas con ?tab= (probá ← → Inicio Fin con el teclado).">
        <Card padding="md">
          <Tabs
            label="Detalle de la empresa"
            paramName="tab"
            items={[
              { id: "resumen", label: "Resumen", icon: "home" },
              { id: "ventas", label: "Ventas", icon: "payments", count: 128 },
              { id: "errores", label: "Con error", icon: "alert", count: 3, countTone: "danger" },
              { id: "usuarios", label: "Usuarios", icon: "clients", count: 4 },
              { id: "avanzado", label: "Avanzado", disabled: true },
            ]}
          >
            {(active) => (
              <p className="catalog-muted">
                Panel activo: <strong>{active}</strong>. El contenido de cada pestaña se renderiza solo cuando está activa.
              </p>
            )}
          </Tabs>
        </Card>
      </Section>

      <Section id="tablas" title="Tablas" description="Tabla real en escritorio; debajo de 640px cada fila es una tarjeta. Click en una fila (o Enter) dispara la acción.">
        <div className="catalog-stack">
          <div>
            <DataTable
              caption="Ventas de hoy"
              showCaption
              columns={columns}
              rows={DEMO_SALES}
              getRowKey={(row) => row.id}
              onRowClick={(row) => toast.info(`Venta de ${row.customer}`, { description: "En una pantalla real abriría el detalle." })}
              getRowLabel={(row) => `Ver venta de ${row.customer}`}
            />
            <Pagination page={page} pageCount={20} onPageChange={setPage} totalItems={392} pageSize={20} itemLabel="ventas" />
          </div>
          <div className="catalog-grid catalog-grid--3">
            <Specimen label="Cargando">
              <DataTable caption="Ventas (cargando)" columns={columns.slice(0, 3)} rows={null} getRowKey={(row) => row.id} isLoading skeletonRows={3} />
            </Specimen>
            <Specimen label="Vacío">
              <DataTable
                caption="Ventas (vacío)"
                columns={columns.slice(0, 3)}
                rows={[]}
                getRowKey={(row) => row.id}
                empty={{ icon: "search-empty", title: "Todavía no hay ventas.", description: "Cuando Mercado Pago registre la primera, la vas a ver acá." }}
              />
            </Specimen>
            <Specimen label="Error">
              <DataTable
                caption="Ventas (error)"
                columns={columns.slice(0, 3)}
                rows={null}
                getRowKey={(row) => row.id}
                errorMessage="No pudimos conectar con el servidor. Reintentá en unos minutos."
                onRetry={() => toast.info("Reintentando…")}
              />
            </Specimen>
          </div>
          <Specimen label="Encabezado fijo (stickyHeader) + compacta">
            <DataTable
              caption="Ventas (encabezado fijo)"
              columns={columns}
              rows={[...DEMO_SALES, ...DEMO_SALES.map((sale) => ({ ...sale, id: `${sale.id}-b` }))]}
              getRowKey={(row) => row.id}
              stickyHeader
              maxHeight="15rem"
              density="compact"
            />
          </Specimen>
        </div>
      </Section>

      <Section id="formularios" title="Formularios" description="Etiqueta, ayuda y error asociados con aria-describedby; el asterisco se lee como “obligatorio”.">
        <Card>
          <div className="catalog-grid catalog-grid--2">
            <TextField label="Razón social" required placeholder="Ej.: Kiosco Don Pepe SRL" hint="Tal cual figura en ARCA." />
            <TextField label="CUIT" required defaultValue="30-7123456" error="El CUIT tiene que tener 11 dígitos." inputMode="numeric" />
            <TextField label="Importe" leading="$" inputMode="decimal" placeholder="0,00" />
            <SelectField
              label="Condición frente al IVA"
              required
              placeholder="Elegí una opción"
              defaultValue=""
              options={[
                { value: "mono", label: "Monotributista" },
                { value: "ri", label: "Responsable inscripto" },
                { value: "exento", label: "Exento" },
              ]}
            />
            <PasswordField label="Contraseña" hint="Mínimo 10 caracteres." autoComplete="new-password" />
            <TextField label="Punto de venta" optional disabled defaultValue="3" hint="Lo configura el equipo de soporte." />
            <TextareaField label="Notas internas" optional placeholder="Visible solo para el equipo interno." fieldClassName="catalog-span-2" />
          </div>
        </Card>
      </Section>

      <Section id="numeros" title="Importes y números fiscales" description="Monoespaciada con cifras tabulares: las columnas de importes se alinean.">
        <div className="catalog-grid catalog-grid--2">
          <Specimen label="Money">
            <div className="catalog-money">
              <Money value={1284500.4} size="xl" />
              <Money value={18450.5} size="lg" />
              <Money value="96200" />
              <Money value={-3250.75} colorBySign signDisplay="always" />
              <Money value={1520} colorBySign signDisplay="always" />
              <Money value={29} currency="USD" />
              <Money value={null} fallback="Sin importe" />
            </div>
          </Specimen>
          <Specimen label="FiscalNumber">
            <dl className="catalog-dl">
              <dt>CUIT</dt>
              <dd><FiscalNumber kind="cuit" value="20123456789" /></dd>
              <dt>CAE</dt>
              <dd><FiscalNumber kind="cae" value="75412345678901" /></dd>
              <dt>Comprobante</dt>
              <dd><FiscalNumber kind="comprobante" ptoVta={1} number={42} /></dd>
              <dt>Comprobante (texto)</dt>
              <dd><FiscalNumber kind="comprobante" value="3-1842" /></dd>
              <dt>Sin dato</dt>
              <dd><FiscalNumber kind="cae" value={null} /></dd>
            </dl>
          </Specimen>
        </div>
      </Section>

      <Section id="firma" title="Ticket y sello" description="La firma de la marca: se usa en el momento de éxito y en el resumen de un comprobante emitido.">
        <div className="catalog-grid catalog-grid--ticket">
          <Ticket
            key={stampKey}
            eyebrow="Factura C · 00003-00001842"
            title={<>Listo, ya está facturado.</>}
            stamp={<Stamp sublabel="15/10/2026" />}
          >
            <TicketRows>
              <TicketRow label="Cliente" value="Consumidor final" />
              <TicketRow label="Medio de pago" value="Tarjeta de débito" />
              <TicketRow label="CAE" value={<FiscalNumber kind="cae" value="75412345678901" />} />
              <TicketRow label="Vencimiento CAE" value="25/10/2026" />
              <TicketRow label="Total" value={<Money value={18450.5} />} emphasis />
            </TicketRows>
            <TicketDivider />
            <div className="catalog-row">
              <Button size="sm" variant="primary" iconLeft="download">Descargar PDF</Button>
              <Button size="sm" variant="ghost" iconLeft="refresh" onClick={() => setStampKey((value) => value + 1)}>Volver a sellar</Button>
            </div>
          </Ticket>
          <div className="catalog-stack">
            <Specimen label="Stamp · sm / md / lg">
              <div className="catalog-row catalog-row--stamps">
                <Stamp size="sm" animate={false} />
                <Stamp sublabel="ARCA" animate={false} />
                <Stamp size="lg" sublabel="15/10/2026" animate={false} />
              </div>
            </Specimen>
            <Specimen label="Stamp · danger (anulada)">
              <div className="catalog-row catalog-row--stamps">
                <Stamp tone="danger" label="ANULADA" sublabel="16/10/2026" animate={false} />
              </div>
            </Specimen>
            <Ticket edges="top" padding="sm" eyebrow="Ticket · edges=top">
              <p className="catalog-muted">Para tarjetas que continúan hacia abajo.</p>
            </Ticket>
          </div>
        </div>
      </Section>

      <Section id="feedback" title="Avisos, vacíos y carga">
        <div className="catalog-grid catalog-grid--2">
          <Callout tone="success" title="Listo, ya está facturado.">La factura C 00003-00001842 quedó emitida en ARCA.</Callout>
          <Callout tone="warning" title="3 ventas necesitan revisión." actions={<Button size="sm" variant="secondary">Ver ventas</Button>}>
            ARCA no respondió. Se reintentan solas; si sigue así, revisá el certificado.
          </Callout>
          <Callout tone="danger" title="No pudimos conectar con ARCA." onDismiss={() => toast.info("Aviso cerrado")}>
            Reintentá en unos minutos o revisá el certificado.
          </Callout>
          <Callout tone="info" title="Disponible en el plan Profesional.">Las notas de crédito automáticas están incluidas en ese plan.</Callout>
          <Callout tone="neutral">Aviso neutro sin título, para aclaraciones.</Callout>
          <Specimen label="Skeleton · line / block / circle">
            <div className="catalog-skeletons">
              <Skeleton variant="circle" />
              <Skeleton lines={3} />
              <Skeleton variant="block" height="3rem" />
            </div>
          </Specimen>
        </div>
        <div className="catalog-grid catalog-grid--2">
          <Card padding="sm">
            <EmptyState
              icon="receipt"
              title="Todavía no hay facturas."
              description="Cuando Mercado Pago registre tu primera venta, la facturamos sola y la vas a ver acá."
              action={<ButtonLink to="/admin/ui" variant="secondary" size="sm">Ver cómo funciona</ButtonLink>}
            />
          </Card>
          <Card padding="sm">
            <ErrorState message="No pudimos cargar las ventas. Revisá tu conexión." onRetry={() => toast.info("Reintentando…")} />
          </Card>
        </div>
      </Section>

      <Section id="capas" title="Diálogos y toasts" description="Escape cierra, el foco queda atrapado adentro y vuelve al botón que lo abrió.">
        <div className="catalog-stack">
          <div className="catalog-row">
            <Button onClick={() => setDrawerOpen(true)} iconLeft="settings">Abrir drawer</Button>
            <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
            <Button onClick={runConfirm}>Confirmar (useConfirm)</Button>
            <Button variant="danger-soft" onClick={runDangerConfirm}>Anular con “ANULAR”</Button>
            <Button onClick={runPrompt}>Pedir texto (usePrompt)</Button>
          </div>
          <div className="catalog-row">
            <Button variant="secondary" onClick={() => toast.success("Listo, ya está facturado.", { description: "Factura C 00003-00001842 por $ 18.450,50." })}>Toast éxito</Button>
            <Button variant="secondary" onClick={() => toast.error("No pudimos conectar con ARCA.", { description: "Reintentá en unos minutos o revisá el certificado." })}>Toast error</Button>
            <Button
              variant="secondary"
              onClick={() => toast.info("Cambios guardados.", { action: { label: "Deshacer", onClick: () => toast.info("Cambios deshechos.") } })}
            >
              Toast con acción
            </Button>
          </div>
          <p className="catalog-result" role="status">{lastResult}</p>
        </div>
      </Section>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerNote("");
        }}
        title="Editar integración de Mercado Pago"
        description="Si escribís algo y cerrás con Escape o el fondo, te pide confirmación."
        dirty={drawerNote.trim().length > 0}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDrawerOpen(false); setDrawerNote(""); }}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                setDrawerOpen(false);
                setDrawerNote("");
                toast.success("Cambios guardados.");
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="catalog-stack">
          <TextField label="Punto de venta (POS)" defaultValue="Caja 1" />
          <SelectField
            label="Revisar ventas cada"
            defaultValue="5"
            options={[
              { value: "1", label: "1 minuto" },
              { value: "5", label: "5 minutos" },
              { value: "15", label: "15 minutos" },
            ]}
          />
          <TextareaField label="Nota" optional value={drawerNote} onChange={(event) => setDrawerNote(event.target.value)} />
        </div>
      </Drawer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal informativo"
        description="Para contenido corto que no es una confirmación."
        footer={<Button variant="primary" onClick={() => setModalOpen(false)}>Entendido</Button>}
      >
        <p className="catalog-muted">Los diálogos se montan en el body con un portal y bloquean el scroll de la página.</p>
      </Modal>
    </main>
  );
}
