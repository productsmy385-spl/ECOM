"use client";

import { AdiraLoader } from "@ecom/ui/loader";
import { useEffect, useState } from "react";

/**
 * Brief branded loader (the animated Adira logo) over the first page of a visit. Hidden as soon as the
 * page has loaded (and at most after 2.5 s); not shown again in the session.
 */
export function Preloader() {
  const [state, setState] = useState<"show" | "hiding" | "gone">("show");
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("ecom_loaded") === "1";
      sessionStorage.setItem("ecom_loaded", "1");
    } catch {
      /* storage blocked: still hide normally */
    }
    if (seen) {
      const raf = requestAnimationFrame(() => setState("gone"));
      return () => cancelAnimationFrame(raf);
    }
    const hide = () => {
      setState("hiding");
      setTimeout(() => setState("gone"), 300);
    };
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
    const cap = setTimeout(hide, 2500);
    return () => {
      window.removeEventListener("load", hide);
      clearTimeout(cap);
    };
  }, []);
  if (state === "gone") return null;
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white/90 transition-opacity duration-300 ${state === "hiding" ? "opacity-0" : "opacity-100"}`}
    >
      <AdiraLoader size={96} label="" />
    </div>
  );
}
