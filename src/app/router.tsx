import { createBrowserRouter } from "react-router-dom";
import { ProtectedLayout } from "@/components/auth/ProtectedLayout";
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
import { LoginPage } from "@/pages/LoginPage";
import { PaymentDetailPage } from "@/pages/PaymentDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TenantDetailPage } from "@/pages/TenantDetailPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/portal-cliente",
    element: <ClientPortalPage />,
  },
  {
    path: "/",
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
