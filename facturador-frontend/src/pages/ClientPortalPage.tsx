import { AppIcon } from "@/components/ui/AppIcon";

type ClientIconName =
  | "home"
  | "invoice"
  | "payments"
  | "clients"
  | "tax"
  | "integrations"
  | "account"
  | "settings"
  | "logout"
  | "refresh"
  | "bell"
  | "download"
  | "check"
  | "help";

function ClientIcon({ name }: { name: ClientIconName }) {
  return <AppIcon name={name} />;
}

const clientNav = [
  ["Inicio", "home"],
  ["Mis facturas", "invoice"],
  ["Pagos", "payments"],
  ["Clientes", "clients"],
  ["Datos fiscales", "tax"],
  ["Integraciones", "integrations"],
  ["Estado de cuenta", "account"],
  ["Configuracion", "settings"],
] as const;

const invoiceRows = [
  ["B 0001-00001235", "14/05/2024", "Juan Perez", "$ 12.540", "Pagada"],
  ["B 0001-00001234", "14/05/2024", "Maria Gomez", "$ 8.750", "Pagada"],
  ["B 0001-00001233", "13/05/2024", "Cordoba SRL", "$ 15.230", "Pendiente"],
  ["B 0001-00001232", "13/05/2024", "Lopez y Asociados", "$ 22.100", "Pagada"],
] as const;

export function ClientPortalPage() {
  return (
    <div className="client-portal-page">
      <aside className="client-sidebar">
        <div className="brand-lockup">
          <span className="app-logo" aria-hidden="true">
            <svg viewBox="0 0 48 56">
              <path d="M12 4h22l10 10v34a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" />
              <path d="M34 4v12h10" />
              <path d="M17 28h10M17 38h7" />
              <circle cx="35" cy="36" r="9" />
              <path d="m31 36 3 3 6-7" />
            </svg>
          </span>
          <div>
            <strong>Facturador</strong>
            <p>Portal del cliente</p>
          </div>
        </div>

        <nav className="app-nav" aria-label="Portal cliente">
          {clientNav.map(([label, icon], index) => (
            <a key={label} href="#inicio" className={`app-nav__link${index === 0 ? " app-nav__link--active" : ""}`}>
              <ClientIcon name={icon} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="client-plan-card">
          <span>Plan actual</span>
          <strong>Profesional</strong>
          <small>Hasta el 12/06/2025</small>
          <em>Activo</em>
        </div>
        <div className="sidebar-user-card">
          <span className="sidebar-user-card__avatar">DO</span>
          <div>
            <strong>Ferreteria del Centro</strong>
            <small>Diego Orlando</small>
          </div>
        </div>
        <button type="button" className="sidebar-logout-button">
          <ClientIcon name="logout" />
          <span>Cerrar sesion</span>
        </button>
      </aside>

      <main className="client-main" id="inicio">
        <header className="app-topbar">
          <div>
            <strong>Hola, Diego <span aria-hidden="true">👋</span></strong>
            <span>Este es el resumen de tu facturacion y pagos.</span>
          </div>
          <div className="app-topbar__actions">
            <span className="topbar-sync">Ultima actualizacion: hace 2 min</span>
            <button type="button" className="secondary-button topbar-refresh-button">
              <ClientIcon name="refresh" />
              <span>Actualizar</span>
            </button>
            <button type="button" className="notification-button" aria-label="Notificaciones">
              <ClientIcon name="bell" />
              <span>2</span>
            </button>
          </div>
        </header>

        <section className="client-kpi-grid">
          {[
            ["payments", "Pagos recibidos hoy", "$ 78.540", "+22% vs ayer", "green"],
            ["invoice", "Facturas emitidas hoy", "24", "+18% vs ayer", "blue"],
            ["clients", "Pendientes de emision", "3", "Vencen en 2 dias", "orange"],
            ["account", "Estado de cuenta", "$ -15.430", "Saldo actual", "violet"],
          ].map(([icon, label, value, detail, tone]) => (
            <article key={label} className={`client-kpi-card client-kpi-card--${tone}`}>
              <span><ClientIcon name={icon as ClientIconName} /></span>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </section>

        <section className="client-success-card">
          <span><ClientIcon name="check" /></span>
          <div>
            <strong>Todo funciona correctamente!</strong>
            <p>No tienes alertas pendientes. La facturacion automatica esta activa.</p>
          </div>
          <button type="button" className="secondary-button">Ver integraciones</button>
        </section>

        <section className="client-table-card">
          <div className="admin-section-heading">
            <h2>Ultimas facturas emitidas</h2>
            <a href="#inicio">Ver todas</a>
          </div>
          <div className="client-invoices-table">
            <div className="client-invoices-table__head">
              <span>Factura</span>
              <span>Fecha</span>
              <span>Cliente</span>
              <span>Importe</span>
              <span>Estado</span>
              <span>Accion</span>
            </div>
            {invoiceRows.map(([number, date, client, amount, status]) => (
              <div key={number} className="client-invoices-table__row">
                <strong>{number}</strong>
                <span>{date}</span>
                <span>{client}</span>
                <span>{amount}</span>
                <span><small className={`status-pill status-pill--${status === "Pagada" ? "success" : "warning"}`}>{status}</small></span>
                <span><button type="button" className="icon-button"><ClientIcon name="download" /></button></span>
              </div>
            ))}
          </div>
        </section>

        <section className="client-bottom-grid">
          <article className="client-list-card">
            <div className="admin-section-heading">
              <h2>Pagos recientes</h2>
              <a href="#inicio">Ver todas</a>
            </div>
            {[
              ["Pago recibido - Mercado Pago", "Hoy, 14:32", "$ 25.430"],
              ["Pago recibido - Transferencia", "Hoy, 11:20", "$ 18.750"],
              ["Pago recibido - Tarjeta", "Ayer, 16:45", "$ 12.340"],
            ].map(([title, date, amount]) => (
              <div key={title} className="client-payment-row">
                <span><ClientIcon name="payments" /></span>
                <div>
                  <strong>{title}</strong>
                  <small>{date}</small>
                </div>
                <div>
                  <strong>{amount}</strong>
                  <small className="status-pill status-pill--success">Acreditado</small>
                </div>
              </div>
            ))}
          </article>

          <article className="client-list-card">
            <div className="admin-section-heading">
              <h2>Integraciones</h2>
              <a href="#inicio">Ver todas</a>
            </div>
            {[
              ["Mercado Pago", "Ultima consulta hace 1 min"],
              ["ARCA", "Ultimo CAE hace 8 min"],
              ["Google Drive", "Ultima subida hace 4 min"],
              ["Google Sheets", "Ultima escritura hace 4 min"],
            ].map(([name, detail]) => (
              <div key={name} className="client-integration-row">
                <strong>{name}</strong>
                <small className="status-pill status-pill--success">Conectado</small>
                <span>{detail}</span>
              </div>
            ))}
          </article>
        </section>

        <section className="client-help-card">
          <span><ClientIcon name="help" /></span>
          <div>
            <strong>Necesitas ayuda?</strong>
            <p>Accede a nuestra base de conocimientos o contacta a soporte.</p>
          </div>
          <button type="button" className="secondary-button">Ir a ayuda</button>
          <button type="button" className="secondary-button">Contactar soporte</button>
        </section>
      </main>
    </div>
  );
}
