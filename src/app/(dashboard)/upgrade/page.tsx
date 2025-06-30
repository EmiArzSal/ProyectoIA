import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

const Page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="flex-1 py-4 px-4 md:px-8 flex flex-col items-center justify-center gap-y-8">
      <Image src="/working.svg" alt="Empty" width={240} height={240} />
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-3xl font-bold text-gray-800">
          Sección en Desarrollo
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          Estamos trabajando en esta sección para mejorar tu experiencia. 
          Por ahora, disfruta de todas las funcionalidades disponibles de forma gratuita.
        </p>
        <div className="pt-4">
          <a 
            href="/dashboard" 
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            Volver al dashboard principal
          </a>
        </div>
      </div>
    </div>
  );
};

export default Page; 