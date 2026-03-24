"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export const CallEnded = () => {
  return (
    <div className="flex flex-col justify-center items-center h-full bg-radial from-sidebar to-sidebar-accent">
      <div className="py-4 px-8 flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg shadow-sm p-10">
          <div className="flex flex-col gap-y-2 text-center">
            <h6 className="text-lg font-medium">Has finalizado la entrevista </h6>
            <p className="text-sm">
              El resumen de esta entrevista aparecerá en unos minutos.
            </p>
          </div>
          <Button variant="default" asChild>
            <Link href="/meetings">
              Volver a mis entrevistas
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};