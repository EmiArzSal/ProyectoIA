import { redirect } from "next/navigation";
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function HomePage() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session) {
      // Si el usuario está autenticado, redirigir al dashboard
      redirect("/dashboard");
    } else {
      // Si no está autenticado, redirigir al sign-in
      redirect("/sign-in");
    }
  } catch (error) {
    // Si hay un error en la autenticación (ej: variables de entorno no configuradas)
    // redirigir al sign-in como fallback
    console.error("Error checking session:", error);
    redirect("/sign-in");
  }
} 