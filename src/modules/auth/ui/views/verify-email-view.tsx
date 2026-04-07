"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailIcon, CheckCircle2Icon, XCircleIcon, LoaderIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export const VerifyEmailView = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const email = searchParams.get("email") ?? "";

  // If there's a token in the URL, Better-Auth handles verification automatically.
  // This view handles three states:
  // 1. Just registered → "check your inbox" (no params)
  // 2. error=invalid_token → show error
  // 3. Generic error

  const isError = !!error;

  const handleResend = async () => {
    if (!email || resending || resent) return;
    setResending(true);
    await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
    setResending(false);
    setResent(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0 border-none">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-8 flex flex-col items-center justify-center gap-6 text-center">
            {isError ? (
              <>
                <div className="p-4 rounded-full bg-destructive/10">
                  <XCircleIcon className="size-10 text-destructive" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Enlace inválido</h1>
                  <p className="text-muted-foreground text-sm mt-2">
                    El enlace de verificación expiró o ya fue usado.<br />
                    Solicita uno nuevo desde el inicio de sesión.
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/sign-in">Ir al inicio de sesión</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 rounded-full bg-blue-50">
                  <MailIcon className="size-10 text-blue-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Revisa tu correo</h1>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    Te enviamos un enlace de verificación a{" "}
                    {email && <strong className="text-foreground">{email}</strong>}.{" "}
                    Haz clic en el enlace para activar tu cuenta.
                  </p>
                </div>

                <div className="w-full flex flex-col gap-3">
                  {resent ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2Icon className="size-4" />
                      Correo reenviado correctamente
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleResend}
                      disabled={!email || resending}
                    >
                      {resending ? (
                        <><LoaderIcon className="size-4 animate-spin mr-2" /> Reenviando...</>
                      ) : (
                        "Reenviar correo de verificación"
                      )}
                    </Button>
                  )}
                  <Button variant="ghost" asChild className="w-full text-muted-foreground">
                    <Link href="/sign-in">Volver al inicio de sesión</Link>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  ¿No ves el correo? Revisa tu carpeta de spam.
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
