import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { UserProvider } from "./components/contexts/UserContext";
import { HashRouter } from "react-router-dom"; // تم التعديل هنا

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UserProvider>
      <HashRouter> {/* تم التعديل هنا */}
        <App />
      </HashRouter>
    </UserProvider>
  </React.StrictMode>
);
