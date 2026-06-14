import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker so the PWA can be installed on home screens and
// continue showing the shell offline. Skips registration in dev to avoid
// confusing Vite HMR caching.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const isDev =
      typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
    if (isDev) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* registration is best-effort */
      });
  });
}
