import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/app/AuthContext";
import { TenantAuthProvider } from "@/app/TenantAuthContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { router } from "@/app/router";
import "@/styles/theme.css";
import "@/styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <TenantAuthProvider>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </TenantAuthProvider>
    </AuthProvider>
  </React.StrictMode>,
);
