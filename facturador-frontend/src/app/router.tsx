import { createBrowserRouter } from "react-router-dom";
import { ProtectedLayout } from "@/components/auth/ProtectedLayout";
import { TenantProtectedLayout } from "@/components/auth/TenantProtectedLayout";
import { ClientPortalLayout } from "@/components/layout/ClientPortalLayout";
import {
  AlertsSectionPage,
  BillingSectionPage,
  ClientsSectionPage,
  IntegrationsSectionPage,
} from "@/pages/AdminSectionPages";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountPage } from "@/pages/AccountPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { ClientPortalPage } from "@/pages/ClientPortalPage";
import { ClientLoginPage } from "@/pages/ClientLoginPage";
import { ClientPaymentDetailPage } from "@/pages/ClientPaymentDetailPage";
import { ClientPaymentsPage } from "@/pages/ClientPaymentsPage";
import { ClientReportsPage } from "@/pages/ClientReportsPage";
import { ClientIntegrationsPage } from "@/pages/ClientIntegrationsPage";
import { ClientFiscalProfilePage } from "@/pages/ClientFiscalProfilePage";
import { ClientOnboardingPage } from "@/pages/ClientOnboardingPage";
import { ClientInvoicesPage } from "@/pages/ClientInvoicesPage";
import { ClientInvoiceDetailPage } from "@/pages/ClientInvoiceDetailPage";
import { LoginPage } from "@/pages/LoginPage";
import { PaymentDetailPage } from "@/pages/PaymentDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TenantDetailPage } from "@/pages/TenantDetailPage";
import { AuditPage } from "@/pages/AuditPage";
import { LandingPage } from "@/pages/LandingPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TutorialsPage } from "@/pages/TutorialsPage";
import { ClientSubscriptionPage } from "@/pages/ClientSubscriptionPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { NotFoundPage, RouteErrorPage } from "@/pages/NotFoundPage";
import { PrivacyPage, TermsPage, WithdrawalPage } from "@/pages/LegalPage";

export const router = createBrowserRouter([{
  // Ruta raíz sin elemento: solo aporta el errorElement para todo el árbol.
  errorElement: <RouteErrorPage />,
  children: [
  { path: "/", element: <LandingPage /> },
  { path: "/registro", element: <RegisterPage /> },
  { path: "/tutoriales", element: <TutorialsPage /> },
  { path: "/verificar-email", element: <VerifyEmailPage /> },
  { path: "/recuperar-contrasena", element: <ForgotPasswordPage /> },
  { path: "/restablecer-contrasena", element: <ResetPasswordPage /> },
  { path: "/terminos", element: <TermsPage /> },
  { path: "/privacidad", element: <PrivacyPage /> },
  { path: "/arrepentimiento", element: <WithdrawalPage /> },
  {
    path: "/login",
    element: <LoginPage />,
  },
  { path: "/portal-cliente/login", element: <ClientLoginPage /> },
  {
    path: "/portal-cliente",
    element: <TenantProtectedLayout />,
    children: [{
      element: <ClientPortalLayout />,
      children: [
        { index: true, element: <ClientPortalPage /> },
        { path: "pagos", element: <ClientPaymentsPage /> },
        { path: "pagos/:id", element: <ClientPaymentDetailPage /> },
        { path: "reportes", element: <ClientReportsPage /> },
        { path: "integraciones", element: <ClientIntegrationsPage /> },
        { path: "perfil-fiscal", element: <ClientFiscalProfilePage /> },
        { path: "onboarding", element: <ClientOnboardingPage /> },
        { path: "comprobantes", element: <ClientInvoicesPage /> },
        { path: "comprobantes/:id", element: <ClientInvoiceDetailPage /> },
        { path: "suscripcion", element: <ClientSubscriptionPage /> },
      ],
    }],
  },
  {
    path: "/admin",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "tenants",
        element: <ClientsSectionPage />,
      },
      {
        path: "billing",
        element: <BillingSectionPage />,
      },
      {
        path: "payments",
        element: <BillingSectionPage />,
      },
      {
        path: "integrations",
        element: <IntegrationsSectionPage />,
      },
      {
        path: "alerts",
        element: <AlertsSectionPage />,
      },
      {
        path: "audit",
        element: <AuditPage />,
      },
      {
        path: "account",
        element: <AccountPage />,
      },
      {
        path: "admins",
        element: <AdminUsersPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "tenants/:slug",
        element: <TenantDetailPage />,
      },
      {
        path: "payments/:id",
        element: <PaymentDetailPage />,
      },
      {
        // Catálogo interno del sistema de diseño (solo admins logueados). Carga diferida:
        // no suma peso al bundle principal.
        path: "ui",
        lazy: async () => ({ Component: (await import("@/pages/ComponentCatalogPage")).ComponentCatalogPage }),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
  ],
}]);
