"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const REDIRECT_SECONDS = 5;

/** Better Auth's error codes for a failed verification link. */
const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: "El enlace de verificación venció.",
  INVALID_TOKEN: "El enlace de verificación no es válido o ya se usó.",
  USER_NOT_FOUND: "No encontramos la cuenta de este enlace.",
};

/**
 * Where the verification link lands (callbackURL). Better Auth signs the user
 * in before redirecting here, or appends ?error=CODE when the link failed.
 */
export const EmailVerifiedView = () => {
  const router = useRouter();
  const error = useSearchParams().get("error");
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (error) return;
    if (seconds <= 0) {
      router.replace("/dashboard");
      return;
    }
    const timer = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [error, seconds, router]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0 border-none">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-8 flex flex-col items-center justify-center gap-6 text-center">
            {error ? (
              <>
                <div className="p-4 rounded-full bg-destructive/10">
                  <XCircleIcon className="size-10 text-destructive" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Enlace inválido</h1>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    {ERROR_MESSAGES[error] ?? "No pudimos verificar tu correo."}{" "}
                    Inicia sesión para pedir un enlace nuevo.
                  </p>
                </div>
                <Button className="w-full" nativeButton={false} render={<Link href="/sign-in" />}>
                  Ir al inicio de sesión
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 rounded-full bg-emerald-50 dark:bg-emerald-950">
                  <CheckCircle2Icon className="size-10 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Tu correo quedó verificado</h1>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    Tu cuenta está activa y ya iniciaste sesión. Puedes empezar tu primera entrevista.
                  </p>
                </div>
                <Button className="w-full" nativeButton={false} render={<Link href="/dashboard" replace />}>
                  Ir a mi panel
                </Button>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  Te llevaremos automáticamente en {seconds} {seconds === 1 ? "segundo" : "segundos"}.
                </p>
              </>
            )}
          </div>

          <div className="bg-radial from-sidebar to-sidebar-accent relative hidden md:flex flex-col items-center justify-center gap-y-4">
            <Image src="/logo.png" alt="Logo Agora" width={112} height={112} />
            <p className="text-2xl font-bold">AGORA</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
