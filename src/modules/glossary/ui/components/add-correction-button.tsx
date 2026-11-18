"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

/** Turns a correction into a glossary card (what you said → the corrected version). */
export function AddCorrectionButton({
  correctionId,
  inGlossary,
  className,
}: {
  correctionId: string;
  inGlossary: boolean;
  className?: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const add = useMutation(trpc.glossary.addCorrection.mutationOptions({
    onSuccess: () => {
      toast.success("Agregada a tus tarjetas. Aparecerá en tu próximo repaso.");
      void queryClient.invalidateQueries({ queryKey: trpc.corrections.pathKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.glossary.pathKey() });
    },
    onError: (err) => toast.error(err.message),
  }));

  if (inGlossary || add.isSuccess) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-emerald-700", className)}>
        <CheckIcon className="size-3.5" /> En tus tarjetas
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-7 gap-1 text-xs", className)}
      disabled={add.isPending}
      onClick={(e) => { e.stopPropagation(); add.mutate({ correctionId }); }}
    >
      {add.isPending ? <LoaderIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
      Agregar a mis tarjetas
    </Button>
  );
}
