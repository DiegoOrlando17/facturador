import { type FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { getAdminRoleLabel } from "@/lib/adminPermissions";
import { formatDateTime } from "@/lib/formatters";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: "SUPERADMIN" | "OPERATOR" | "VIEWER";
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "VIEWER" as AdminUser["role"],
  status: "ACTIVE" as AdminUser["status"],
};

export function AdminUsersPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token && user?.role === "SUPERADMIN") {
      void loadUsers();
    }
  }, [token, user?.role]);

  if (user && user.role !== "SUPERADMIN") {
    return <Navigate to="/" replace />;
  }

  async function loadUsers() {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<AdminUsersResponse>("/admin/users", { token });
      setItems(response.items);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "No se pudieron cargar los administradores."));
    } finally {
      setIsLoading(false);
    }
  }

  function startEdit(adminUser: AdminUser) {
    setEditingUserId(adminUser.id);
    setIsFormOpen(true);
    setForm({
      name: adminUser.name ?? "",
      email: adminUser.email,
      password: "",
      role: adminUser.role,
      status: adminUser.status,
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function clearForm({ keepMessages = false } = {}) {
    setEditingUserId(null);
    setIsFormOpen(false);
    setForm(emptyForm);
    if (!keepMessages) {
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setErrorMessage("Tu sesion no esta disponible. Ingresa nuevamente.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Completa el email.");
      return;
    }

    if (!editingUserId && form.password.length < 8) {
      setErrorMessage("La contrasena inicial debe tener al menos 8 caracteres.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const body = {
        name: form.name,
        email: form.email,
        role: form.role,
        status: form.status,
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingUserId) {
        await apiRequest<AdminUser>(`/admin/users/${editingUserId}`, {
          method: "PATCH",
          token,
          body,
        });
        setSuccessMessage("Administrador actualizado correctamente.");
      } else {
        await apiRequest<AdminUser>("/admin/users", {
          method: "POST",
          token,
          body,
        });
        setSuccessMessage("Administrador creado correctamente.");
      }

      clearForm({ keepMessages: true });
      await loadUsers();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "No se pudo guardar el administrador."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="admin-section-page">
      <div className="admin-section-header">
        <div>
          <h1>Usuarios internos</h1>
          <p>Gestiona permisos, estado y auditoria de accesos internos.</p>
        </div>
        <button
          type="button"
          className="section-button section-button--primary"
          onClick={() => {
            setEditingUserId(null);
            setForm(emptyForm);
            setIsFormOpen(true);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          Crear admin
        </button>
      </div>

      <section className="admin-single-column">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Listado</span>
              <h2>{items.length} administradores</h2>
            </div>
            <button type="button" className="secondary-button" onClick={() => void loadUsers()}>
              Actualizar
            </button>
          </div>

          <div className="admin-users-list">
            {isLoading ? (
              <div className="panel-state">
                <strong>Cargando administradores...</strong>
                <span>Estamos consultando usuarios internos.</span>
              </div>
            ) : items.length > 0 ? (
              items.map((adminUser) => (
                <article key={adminUser.id} className="admin-user-card">
                  <div>
                    <strong>{adminUser.name || adminUser.email}</strong>
                    <span>{adminUser.email}</span>
                    <small>{adminUser.lastLoginAt ? `Ultimo ingreso ${formatDateTime(adminUser.lastLoginAt)}` : "Sin ingresos registrados"}</small>
                  </div>
                  <div className="admin-user-card__actions">
                    <span className={`badge badge--${adminUser.status === "ACTIVE" ? "success" : "muted"}`}>
                      {adminUser.status === "ACTIVE" ? "Activo" : "Deshabilitado"}
                    </span>
                    <span className="badge badge--muted">{getAdminRoleLabel(adminUser.role)}</span>
                    <button type="button" className="secondary-button" onClick={() => startEdit(adminUser)}>
                      Editar
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="panel-state">
                <strong>No hay administradores cargados</strong>
                <span>Crea el primer usuario interno para delegar accesos.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      {isFormOpen ? (
        <div className="drawer-backdrop" role="presentation" onClick={() => clearForm()}>
        <article className="panel side-drawer" onClick={(event) => event.stopPropagation()}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{editingUserId ? "Editar" : "Nuevo"}</span>
              <h2>{editingUserId ? "Editar administrador" : "Crear administrador"}</h2>
            </div>
            <button type="button" className="secondary-button" disabled={isSaving} onClick={() => clearForm()}>
              Cerrar
            </button>
          </div>

          <form className="admin-user-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>Nombre</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nombre visible"
                disabled={isSaving}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="admin@empresa.com"
                disabled={isSaving}
              />
            </label>
            <label className="field">
              <span>Rol</span>
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminUser["role"] }))}
                disabled={isSaving}
              >
                <option value="SUPERADMIN">Superadmin</option>
                <option value="OPERATOR">Operacion</option>
                <option value="VIEWER">Solo lectura</option>
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AdminUser["status"] }))}
                disabled={isSaving}
              >
                <option value="ACTIVE">Activo</option>
                <option value="DISABLED">Deshabilitado</option>
              </select>
            </label>
            <label className="field">
              <span>{editingUserId ? "Nueva contrasena opcional" : "Contrasena inicial"}</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimo 8 caracteres"
                disabled={isSaving}
              />
            </label>

            <div className="tenant-form__actions">
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? "Guardando..." : editingUserId ? "Guardar cambios" : "Crear administrador"}
              </button>
              <button type="button" className="secondary-button" disabled={isSaving} onClick={() => clearForm()}>
                Limpiar
              </button>
            </div>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            {successMessage ? <p className="form-success">{successMessage}</p> : null}
          </form>
        </article>
        </div>
      ) : null}
    </main>
  );
}
