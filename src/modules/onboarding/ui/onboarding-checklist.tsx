"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, CheckIcon, PartyPopperIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

/**
 * "Primeros pasos" on the dashboard: five steps that mark themselves as the
 * user does them, the next one highlighted. Closing it, or acknowledging
 * that everything is done, hides it for good.
 */
export function OnboardingChecklist() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.onboarding.getChecklist.queryOptions());

  const dismiss = useMutation(trpc.onboarding.dismiss.mutationOptions({
    // Hide right away; the server keeps it hidden from now on.
    onMutate: () => queryClient.setQueryData(trpc.onboarding.getChecklist.queryKey(), (old) => old && { ...old, visible: false }),
  }));

  if (!data?.visible) return null;

  if (data.finished) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="p-2 rounded-xl bg-emerald-100 self-start">
            <PartyPopperIcon className="size-5 text-emerald-700" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">¡Completaste los primeros pasos!</p>
            <p className="text-sm text-emerald-800/80">
              Ya conoces todo lo que ofrece Agora. Sigue practicando para mejorar tu nivel.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => dismiss.mutate()} className="self-start sm:self-center">
            Cerrar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.round((data.completed / data.total) * 100);

  return (
    <Card className="animate-in fade-in slide-in-from-top-2 duration-500 motion-reduce:animate-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Primeros pasos</h2>
          <p className="text-sm text-muted-foreground">
            {data.completed} de {data.total} completados · Conoce todo lo que puedes hacer en Agora.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label="Ocultar primeros pasos"
          title="Ocultar"
          onClick={() => dismiss.mutate()}
        >
          <XIcon className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className="h-1.5 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-label="Avance de primeros pasos"
          aria-valuemin={0}
          aria-valuemax={data.total}
          aria-valuenow={data.completed}
        >
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>

        <ol className="flex flex-col gap-2">
          {data.steps.map((step, i) => {
            const isNext = step.id === data.next;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  isNext ? "border-primary/40 bg-primary/5" : "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "size-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
                    step.done ? "bg-emerald-500 text-white" : isNext ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {step.done ? <CheckIcon className="size-4" /> : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                    {step.title}
                    <span className="sr-only">{step.done ? " (completado)" : " (pendiente)"}</span>
                  </p>
                  {!step.done && <p className="text-xs text-muted-foreground">{step.description}</p>}
                </div>
                {!step.done && (
                  <Button
                    size="sm"
                    variant={isNext ? "default" : "ghost"}
                    className="shrink-0 gap-1"
                    nativeButton={false}
                    render={<Link href={step.href} />}
                  >
                    <span className="hidden sm:inline">{step.cta}</span>
                    <ArrowRightIcon className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
