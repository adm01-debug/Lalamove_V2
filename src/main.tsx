import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initWebVitals } from "./utils/webVitals";
import { initErrorMonitoring } from "./services/errorMonitoring";

// Initialize Web Vitals monitoring
initWebVitals({
  debug: import.meta.env.DEV,
  reportToAnalytics: import.meta.env.PROD,
});

// Initialize runtime error monitoring
const cleanupErrorMonitoring = initErrorMonitoring();

// Cleanup on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => cleanupErrorMonitoring());
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
