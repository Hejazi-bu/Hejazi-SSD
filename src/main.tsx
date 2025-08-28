// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { UserProvider } from "./components/contexts/UserContext";
import { LanguageProvider } from "./components/contexts/LanguageContext"; // <-- استيراد
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <UserProvider>
        <LanguageProvider> {/* <-- تغليف */}
          <App />
        </LanguageProvider>
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);