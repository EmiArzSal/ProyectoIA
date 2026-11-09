"use client"

import { Card, CardContent } from "@/components/ui/card"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, CheckCircle2Icon, KeyRoundIcon, OctagonAlertIcon, XCircleIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import Link from "next/link"
import Image from "next/image"

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    confirmPassword: z
      .string()
      .min(1, { message: "La confirmación de contraseña es requerida" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

const translateError = (message: string) => {
  const lower = message.toLowerCase()
  if (lower.includes("invalid token") || lower.includes("token")) {
    return "El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo."
  }
  if (lower.includes("too short") || lower.includes("at least 8")) {
    return "La contraseña debe tener al menos 8 caracteres."
  }
  return "Ocurrió un error al restablecer la contraseña. Intenta de nuevo."
}

export const ResetPasswordView = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const urlError = searchParams.get("error")

  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const isInvalidToken = !token || urlError === "INVALID_TOKEN"

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!token) return
    setError(null)
    setIsPending(true)

    try {
      const res = await authClient.resetPassword({
        newPassword: data.password,
        token,
      })

      if (res.error) {
        setError(translateError(res.error.message || ""))
        setIsPending(false)
        return
      }

      setIsSuccess(true)
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 font-sans">
      <Button
        variant="ghost"
        size="lg"
        className="self-start gap-2 font-sans hover:underline underline-offset-4"
        nativeButton={false}
        render={<Link href="/sign-in" />}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver al inicio de sesión
      </Button>

      <Card className="overflow-hidden p-0 border-none">
        <CardContent className="grid p-0 md:grid-cols-2">
          {isInvalidToken ? (
            <div className="p-8 flex flex-col items-center justify-center gap-6 text-center">
              <div className="p-4 rounded-full bg-destructive/10 text-destructive">
                <XCircleIcon className="size-12" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Enlace inválido o expirado</h1>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  El enlace para restablecer tu contraseña ya no es válido o ha expirado.
                  Por favor solicita uno nuevo.
                </p>
              </div>
              <Button
                className="w-full"
                nativeButton={false}
                render={<Link href="/forgot-password" />}
              >
                Solicitar nuevo enlace
              </Button>
            </div>
          ) : isSuccess ? (
            <div className="p-8 flex flex-col items-center justify-center gap-6 text-center">
              <div className="p-4 rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2Icon className="size-12" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">¡Contraseña actualizada!</h1>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  Tu contraseña se ha modificado exitosamente. Ahora puedes iniciar sesión con tus nuevas credenciales.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/sign-in")}
              >
                Iniciar sesión
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                      <KeyRoundIcon className="size-6" />
                    </div>
                    <h1 className="text-2xl font-bold">Nueva contraseña</h1>
                    <p className="text-muted-foreground text-balance text-sm mt-1">
                      Crea una nueva contraseña segura para tu cuenta institucional
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nueva contraseña</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Mínimo 8 caracteres"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar nueva contraseña</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Repite tu contraseña"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {!!error && (
                    <Alert className="bg-destructive/10 border-none">
                      <OctagonAlertIcon className="h-4 w-4 !text-destructive" />
                      <AlertTitle className="text-sm">{error}</AlertTitle>
                    </Alert>
                  )}

                  <Button
                    disabled={isPending}
                    className="w-full font-sans"
                    type="submit"
                    variant="default"
                    size="lg"
                  >
                    {isPending ? "Actualizando contraseña..." : "Guardar nueva contraseña"}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          <div className="bg-radial from-sidebar to-sidebar-accent relative hidden md:flex flex-col items-center justify-center gap-y-4">
            <Image src="/logo.png" alt="Logo Agora" width={110} height={110} />
            <p className="text-2xl font-bold">Agora</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

