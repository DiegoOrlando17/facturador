import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/app/AuthContext";
import { TenantAuthProvider } from "@/app/TenantAuthContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { router } from "@/app/router";
import "@/styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <TenantAuthProvider>
            <AuthGate>
              <RouterProvider router={router} />
            </AuthGate>
          </TenantAuthProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>,
);
