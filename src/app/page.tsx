import { redirect } from "next/navigation";
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function HomePage() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Si hay sesión, ir directamente al dashboard
    if (session) {
      redirect("/dashboard");
    }
    
    // Si no hay sesión, ir al sign-in
    redirect("/sign-in");
    
  } catch (error) {
    console.error("Error checking session:", error);
    
    // En caso de error, ir al sign-in como fallback seguro
    // Esto evita bucles infinitos si hay problemas con la base de datos o autenticación
    redirect("/sign-in");
  }
} 