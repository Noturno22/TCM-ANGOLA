"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) on the client.
 * Renders nothing; registration is best-effort and never blocks the UI.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* best-effort: ignore registration failures (e.g. unsupported context) */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
