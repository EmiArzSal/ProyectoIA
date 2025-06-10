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
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import Link from "next/link"

const formSchema = z.object({
  name: z.string().min(1, { message: "El nombre es requerido" }),
  email: z.string().email({ message: "El email es requerido" }),
  password: z.string().min(1, { message: "La contraseña es requerida" }),
  confirmPassword: z.string().min(1, { message: "La confirmación de contraseña es requerida" })
})
.refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

export const SignUpView = () => {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setError(null);
    setIsPending(true);
    authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
      callbackURL: "/"
    },
    {
      onSuccess: () => {
        setIsPending(false);
      },
      onError: ({error}) => {
        setError(error.message);
      }
    }
  );
}

  const onSocial = (provider: "github" | "google") => {
    setError(null);
    setIsPending(true);
    authClient.signIn.social({
      provider: provider,
      callbackURL: "/"
    },
    {
      onSuccess: () => {
        setIsPending(false);
      },
      onError: ({error}) => {
        setError(error.message);
      }
    }
  );
}

  return(
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0 border-none">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold text-text">Comencemos!</h1>
                  <p className="text-muted-foreground text-balance">Crea una cuenta</p>
                </div>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Pablo Pérez" {...field} 
                            type="text"
                            autoCapitalize="none"                            
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ejemplo@dominio.com" {...field}
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
                          <Input type="password" placeholder="********" {...field} />
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
                        <FormLabel>Confirmar Contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="********" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!!error &&(
                  <Alert className="bg-destructive/10 border-none">
                    <OctagonAlertIcon className="h-4 w-4 !text-destructive"/>
                    <AlertTitle className="text-sm">{error}</AlertTitle>
                  </Alert>
                )}
                <Button disabled={isPending} className="w-full" type="submit">
                  Crear cuenta
                </Button>
                <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t ">
                  <span className="bg-card text-muted-foreground relative z-10 px-2">
                    O continua con
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" type="button" className="w-full" onClick={() => onSocial("google")}>
                    Google
                  </Button>
                  <Button variant="outline" type="button" className="w-full" onClick={() => onSocial("github")}>
                    Github
                  </Button>
                </div>
                <div className="text-center text-sm">
                    ¿Ya tienes una cuenta? {" "}
                    <Link href="/sign-in" className="text-primary underline">Inicia sesión</Link>
                </div>
              </div>
            </form>
          </Form>

          <div className="bg-radial from-background to-primary relative hidden md:flex flex-col items-center justify-center gap-y-4">
            <img src="/logo.png" alt="Logo Image" className="h-[112px] w-[112px]"/>
            <p className="text-2xl font-bold text-text">
              AGORA
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          Al iniciar sesión, aceptas nuestros{" "}
          <a href="#" className="text-primary">Términos de servicio</a> y {" "}
          <a href="#" className="text-primary">Política de privacidad</a>
      </div>
    </div>
  )
}