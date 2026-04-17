"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { voidPickAction } from "@/app/(app)/picks/actions";

interface VoidPickButtonProps {
  pickId: string;
  matchLabel: string;
}

export function VoidPickButton({ pickId, matchLabel }: VoidPickButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await voidPickAction(pickId);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error ?? "Error desconocido");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Ban className="h-3 w-3" />
        Anular
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Anular este pick?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{matchLabel}</span>
              <br />
              El pick pasará a estado <span className="font-semibold">Nulo</span> y no contará en
              tus cuotas acertadas ni ROI. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Sí, anular
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
