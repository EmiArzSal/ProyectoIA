import { ForgotPasswordView } from "@/modules/auth/ui/views/forgot-password-view"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Recuperar contraseña | Agora",
  description: "Restablece la contraseña de tu cuenta en Agora.",
}

const Page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/dashboard")
  }

  return <ForgotPasswordView />
}

export default Page

