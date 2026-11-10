"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Return a promise; the dialog stays open (button loading) until it settles. */
  onConfirm: () => Promise<unknown> | unknown;
}

/** Accessible confirmation for destructive or sensitive actions. */
export function ConfirmDialog({ trigger, title, description, confirmLabel, destructive, onConfirm }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-fade-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-modal focus:outline-none data-[state=open]:animate-fade-in sm:p-6">
          <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? "destructive" : "default"} isLoading={pending} onClick={confirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
