"use client"

import { Card, CardContent } from "@/components/ui/card"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { OctagonAlertIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
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
    name: z.string().min(1, { message: "El nombre es requerido" }),
    email: z
      .string()
      .email({ message: "Ingresa un correo válido" })
      .refine((email) => email.endsWith("@alumno.ipn.mx"), {
        message: "Solo se permiten correos institucionales @alumno.ipn.mx",
      }),
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
  if (
    message.toLowerCase().includes("user already exists") ||
    message.toLowerCase().includes("email already")
  )
    return "Este correo ya está registrado. ¿Quieres iniciar sesión?"
  if (message.toLowerCase().includes("too many requests"))
    return "Demasiados intentos. Intenta más tarde"
  return "Ocurrió un error al crear la cuenta. Intenta de nuevo"
}

export const SignUpView = () => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setError(null)
    setIsPending(true)
    authClient.signUp.email(
      { name: data.name, email: data.email, password: data.password, callbackURL: "/" },
      {
        onSuccess: () => {
          setIsPending(false)
          router.push("/")
        },
        onError: ({ error }) => {
          setIsPending(false)
          setError(translateError(error.message))
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0 border-none">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
                  <p className="text-muted-foreground text-balance text-sm mt-1">
                    Exclusivo para alumnos con correo @alumno.ipn.mx
                  </p>
                </div>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Pablo Pérez"
                            {...field}
                            type="text"
                            autoCapitalize="words"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
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
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Repite tu contraseña" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!!error && (
                  <Alert className="bg-destructive/10 border-none">
                    <OctagonAlertIcon className="h-4 w-4 !text-destructive" />
                    <AlertTitle className="text-sm">
                      {error}{" "}
                      {error.includes("ya está registrado") && (
                        <Link href="/sign-in" className="underline font-medium">
                          Inicia sesión aquí
                        </Link>
                      )}
                    </AlertTitle>
                  </Alert>
                )}
                <Button disabled={isPending} className="w-full" type="submit">
                  {isPending ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
                <div className="text-center text-sm">
                  ¿Ya tienes una cuenta?{" "}
                  <Link href="/sign-in" className="text-primary underline">
                    Inicia sesión
                  </Link>
                </div>
              </div>
            </form>
          </Form>

          <div className="bg-radial from-sidebar to-sidebar-accent relative hidden md:flex flex-col items-center justify-center gap-y-4">
            <Image src="/logo.png" alt="Logo Agora" width={112} height={112} />
            <p className="text-2xl font-bold">AGORA</p>
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground text-center text-xs text-balance">
        Al registrarte, aceptas nuestros{" "}
        <a href="#" className="text-primary underline underline-offset-4">
          Términos de servicio
        </a>{" "}
        y{" "}
        <a href="#" className="text-primary underline underline-offset-4">
          Política de privacidad
        </a>
      </div>
    </div>
  )
}
