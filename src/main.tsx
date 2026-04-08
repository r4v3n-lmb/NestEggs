import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    console.info("New app version available.");
  },
  onOfflineReady() {
    console.info("App is ready for offline use.");
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
