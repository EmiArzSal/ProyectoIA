"use client"

import { Card, CardContent } from "@/components/ui/card"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, CheckCircle2Icon, MailIcon, OctagonAlertIcon } from "lucide-react"
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

const formSchema = z.object({
  email: z
    .string()
    .email({ message: "Ingresa un correo válido" })
    .refine((email) => email.endsWith("@alumno.ipn.mx"), {
      message: "Solo se permiten correos institucionales @alumno.ipn.mx",
    }),
})

export const ForgotPasswordView = () => {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setError(null)
    setIsPending(true)

    try {
      const res = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: "/reset-password",
      })

      if (res.error) {
        setError(res.error.message || "Ocurrió un error al enviar el correo. Intenta de nuevo.")
        setIsPending(false)
        return
      }

      setSubmittedEmail(data.email)
      setIsSubmitted(true)
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo más tarde.")
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
          {isSubmitted ? (
            <div className="p-8 flex flex-col items-center justify-center gap-6 text-center">
              <div className="p-4 rounded-full bg-blue-50 text-blue-600">
                <CheckCircle2Icon className="size-12" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Correo enviado</h1>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  Si existe una cuenta asociada a{" "}
                  <span className="font-semibold text-foreground">{submittedEmail}</span>,
                  recibirás un enlace para restablecer tu contraseña.
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  El enlace es válido por 1 hora. Revisa también tu carpeta de spam o correo no deseado.
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsSubmitted(false)}
                >
                  Enviar a otro correo
                </Button>
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<Link href="/sign-in" />}
                >
                  Ir al inicio de sesión
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                      <MailIcon className="size-6" />
                    </div>
                    <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
                    <p className="text-muted-foreground text-balance text-sm mt-1">
                      Ingresa tu correo institucional y te enviaremos un enlace para restablecerla
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Correo institucional</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="usuario@alumno.ipn.mx"
                              {...field}
                              type="email"
                              autoCapitalize="none"
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
                    {isPending ? "Enviando enlace..." : "Enviar enlace de recuperación"}
                  </Button>

                  <div className="text-center text-sm">
                    ¿Recordaste tu contraseña?{" "}
                    <Link
                      href="/sign-in"
                      className="auth-signin__signup-link underline underline-offset-4 font-medium"
                    >
                      Iniciar sesión
                    </Link>
                  </div>
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

