"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch (error) {
        console.error(
          "Philamentix Hub Service Worker konnte nicht registriert werden:",
          error,
        );
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, {
      once: true,
    });

    return () => {
      window.removeEventListener(
        "load",
        registerServiceWorker,
      );
    };
  }, []);

  return null;
}
