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
import { LoginPage } from "@/pages/LoginPage";
import { PaymentDetailPage } from "@/pages/PaymentDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TenantDetailPage } from "@/pages/TenantDetailPage";
import { AuditPage } from "@/pages/AuditPage";
import { LandingPage } from "@/pages/LandingPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TutorialsPage } from "@/pages/TutorialsPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/registro", element: <RegisterPage /> },
  { path: "/tutoriales", element: <TutorialsPage /> },
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
    ],
  },
]);
