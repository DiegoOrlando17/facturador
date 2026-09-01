import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/app/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { getAdminRoleLabel } from "@/lib/adminPermissions";
import { formatDateTime } from "@/lib/formatters";

type UpdateProfileResponse = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function AccountPage() {
  const { refreshSession, token, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setErrorMessage("Tu sesion no esta disponible. Ingresa nuevamente.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest<UpdateProfileResponse>("/admin/me", {
        method: "PATCH",
        token,
        body: {
          name,
          email,
        },
      });
      await refreshSession();
      setSuccessMessage("Tus datos se actualizaron correctamente.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "No se pudieron actualizar tus datos."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setPasswordErrorMessage("Tu sesion no esta disponible. Ingresa nuevamente.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErrorMessage("La nueva contrasena debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage("La confirmacion no coincide con la nueva contrasena.");
      return;
    }

    setIsChangingPassword(true);
    setPasswordErrorMessage(null);
    setPasswordSuccessMessage(null);
    try {
      await apiRequest("/admin/me/password", {
        method: "PATCH",
        token,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccessMessage("Tu contrasena se cambio correctamente.");
    } catch (error) {
      setPasswordErrorMessage(getApiErrorMessage(error, "No se pudo cambiar la contrasena."));
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <main className="shell shell--app">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Mi cuenta</span>
          <h1>Mis datos</h1>
          <p>Actualiza tu informacion personal para que el panel muestre claramente quien esta operando.</p>
        </div>

        <div className="spotlight-card">
          <p>Rol asignado</p>
          <strong>{getAdminRoleLabel(user?.role)}</strong>
          <span>{user?.status === "ACTIVE" ? "Cuenta activa" : "Cuenta deshabilitada"}</span>
          <small className="spotlight-card__meta">
            {user?.lastLoginAt ? `Ultimo ingreso ${formatDateTime(user.lastLoginAt)}` : "Sin ingresos previos registrados"}
          </small>
        </div>
      </section>

      <section className="content-grid content-grid--dashboard">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Perfil</span>
              <h2>Datos personales</h2>
            </div>
          </div>

          <form className="account-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                placeholder="Diego"
                disabled={isSaving}
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                placeholder="admin@empresa.com"
                disabled={isSaving}
              />
            </label>

            <div className="tenant-form__actions">
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            {successMessage ? <p className="form-success">{successMessage}</p> : null}
          </form>
        </article>

        <article className="panel api-summary-panel">
          <span className="eyebrow">Acceso</span>
          <h2>Permisos</h2>
          <div className="profile-summary-list">
            <span><strong>Rol</strong>{user?.role ?? "Sin rol"}</span>
            <span><strong>Estado</strong>{user?.status ?? "Sin estado"}</span>
            <span><strong>Creada</strong>{user?.createdAt ? formatDateTime(user.createdAt) : "-"}</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Seguridad</span>
              <h2>Cambiar contrasena</h2>
            </div>
          </div>
          <form className="account-form" onSubmit={(event) => void handlePasswordChange(event)}>
            <label className="field">
              <span>Contrasena actual</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={isChangingPassword} autoComplete="current-password" />
            </label>
            <label className="field">
              <span>Nueva contrasena</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isChangingPassword} autoComplete="new-password" />
            </label>
            <label className="field">
              <span>Confirmar nueva contrasena</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isChangingPassword} autoComplete="new-password" />
            </label>
            <div className="tenant-form__actions">
              <button type="submit" className="primary-button" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                {isChangingPassword ? "Cambiando..." : "Cambiar contrasena"}
              </button>
            </div>
            {passwordErrorMessage ? <p className="form-error">{passwordErrorMessage}</p> : null}
            {passwordSuccessMessage ? <p className="form-success">{passwordSuccessMessage}</p> : null}
          </form>
        </article>
      </section>
    </main>
  );
}
