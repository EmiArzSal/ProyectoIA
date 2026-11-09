import { Suspense } from "react"
import { ResetPasswordView } from "@/modules/auth/ui/views/reset-password-view"

export const metadata = {
  title: "Restablecer contraseña | Agora",
  description: "Ingresa tu nueva contraseña para acceder a Agora.",
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordView />
    </Suspense>
  )
}

