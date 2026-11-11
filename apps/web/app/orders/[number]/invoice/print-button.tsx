"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-pill px-6 py-2.5">
      <Printer className="h-4 w-4" aria-hidden="true" /> Print / Save PDF
    </button>
  );
}
