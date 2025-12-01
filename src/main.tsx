// src/main.tsx
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { UserProvider } from "./components/contexts/UserContext";
import { LanguageProvider } from "./components/contexts/LanguageContext";
import { ServicesProvider } from "./components/contexts/ServicesContext";
import { DialogProvider } from "./components/contexts/DialogContext";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LoadingProvider } from "./components/contexts/LoadingContext";
import { ActionLoadingProvider } from "./components/contexts/ActionLoadingContext";
import { UnsavedChangesProvider } from "./components/contexts/UnsavedChangesContext";
// ✨ 1. استيراد المزود الجديد
import { ConnectivityProvider } from "./components/contexts/ConnectivityContext";
// ✨ نظام التنبيهات اللحظية للصلاحيات
import { RealtimeNotificationsProvider } from "./components/contexts/RealtimeNotificationsContext";

const router = createBrowserRouter([
    {
        path: "*",
        element: <App />,
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <LanguageProvider>
            <DialogProvider>
                <UnsavedChangesProvider>
                    <ServicesProvider>
                        {/* ✨ 1. نقل ConnectivityProvider ليغلف UserProvider */}
                        <ConnectivityProvider>
                            <UserProvider>
                                {/* ✨ نظام التنبيهات اللحظية */}
                                <RealtimeNotificationsProvider>
                                    <LoadingProvider>
                                        <ActionLoadingProvider>
                                            {/* ✨ 2. RouterProvider أصبح بالداخل مباشرة */}
                                            <RouterProvider router={router} />
                                        </ActionLoadingProvider>
                                    </LoadingProvider>
                                </RealtimeNotificationsProvider>
                            </UserProvider>
                        </ConnectivityProvider>
                    </ServicesProvider>
                </UnsavedChangesProvider>
            </DialogProvider>
        </LanguageProvider>
    </React.StrictMode>
);