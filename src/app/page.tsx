import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";

const roles = [
  {
    title: "Frontend Developer",
    description:
      "HTML, CSS, JavaScript, React, accesibilidad y fundamentos de diseño de interfaces.",
    image:
      "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=600&q=80",
  },
  {
    title: "Backend Developer",
    description:
      "REST APIs, bases de datos, autenticación, escalabilidad y diseño de sistemas.",
    image:
      "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&q=80",
  },
  {
    title: "Data Analyst",
    description:
      "SQL, visualización de datos, Python básico y pensamiento analítico.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
  },
  {
    title: "QA Engineer",
    description:
      "Planificación de pruebas, testing manual y automatizado, reporte de bugs.",
    image:
      "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=600&q=80",
  },
  {
    title: "DevOps Engineer",
    description:
      "Linux, pipelines CI/CD, contenedores, servicios en la nube y monitoreo.",
    image:
      "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=600&q=80",
  },
];

export default async function HomePage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#1f2937]">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#e5e7eb]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-[#5b7fbf]">
            Agora
          </span>
          <nav className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-[#1f2937] hover:text-[#5b7fbf] transition-colors px-4 py-2 rounded-lg hover:bg-[#f3f4f6]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-[#5b7fbf] text-white px-4 py-2 rounded-lg hover:bg-[#4a6eae] transition-colors"
            >
              Comenzar gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-widest bg-[#d6e6f5] text-[#5b7fbf] px-3 py-1 rounded-full mb-5">
            Proyecto de tesis — IPN
          </span>
          <h1 className="text-5xl font-bold leading-tight tracking-tight mb-6">
            Practica entrevistas técnicas en inglés con IA
          </h1>
          <p className="text-lg text-[#6b7280] leading-relaxed mb-8">
            Agora es una herramienta educativa desarrollada como proyecto de
            tesis para alumnos del IPN. Simula entrevistas reales con agentes
            de IA especializados en los 5 puestos entry-level más solicitados
            de la industria tech.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/sign-up"
              className="text-base font-semibold bg-[#5b7fbf] text-white px-7 py-3 rounded-xl hover:bg-[#4a6eae] transition-colors text-center"
            >
              Acceder con correo institucional
            </Link>
            <Link
              href="/sign-in"
              className="text-base font-semibold text-[#5b7fbf] border border-[#5b7fbf] px-7 py-3 rounded-xl hover:bg-[#d6e6f5] transition-colors text-center"
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="text-xs text-[#6b7280] mt-4">
            Exclusivo para alumnos con correo <span className="font-medium">@alumno.ipn.mx</span>
          </p>
        </div>
        <div className="relative h-[420px] rounded-2xl overflow-hidden shadow-xl">
          <Image
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&q=85"
            alt="Persona preparándose para una entrevista de trabajo"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      </section>

      {/* Divider stat bar */}
      <div className="border-y border-[#e5e7eb] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-[#5b7fbf]">5</p>
            <p className="text-sm text-[#6b7280] mt-1">roles especializados</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-[#5b7fbf]">100%</p>
            <p className="text-sm text-[#6b7280] mt-1">en inglés técnico</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-[#5b7fbf]">IPN</p>
            <p className="text-sm text-[#6b7280] mt-1">herramienta educativa institucional</p>
          </div>
        </div>
      </div>

      {/* Roles */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-3">Los 5 roles que cubrimos</h2>
          <p className="text-[#6b7280] text-lg max-w-xl">
            Cada agente conoce en profundidad su área y hace preguntas técnicas
            y de comportamiento adaptadas al puesto.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div
              key={role.title}
              className="group bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden hover:border-[#5b7fbf] hover:shadow-lg transition-all"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <Image
                  src={role.image}
                  alt={role.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-base mb-1">{role.title}</h3>
                <p className="text-sm text-[#6b7280] leading-relaxed">
                  {role.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — asymmetric */}
      <section className="bg-white border-y border-[#e5e7eb]">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
          <div className="relative h-[460px] rounded-2xl overflow-hidden shadow-lg">
            <Image
              src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=900&q=85"
              alt="Práctica de entrevista"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#5b7fbf] mb-4">
              Cómo funciona
            </p>
            <h2 className="text-3xl font-bold mb-10">
              Tres pasos para llegar preparado
            </h2>
            <div className="space-y-8">
              <div className="flex gap-5">
                <span className="text-3xl font-bold text-[#d6e6f5] leading-none mt-1 select-none">
                  01
                </span>
                <div>
                  <h3 className="font-semibold mb-1">Elige tu rol</h3>
                  <p className="text-[#6b7280] text-sm leading-relaxed">
                    Selecciona el puesto al que estás aplicando y el agente
                    correspondiente comenzará la sesión.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <span className="text-3xl font-bold text-[#d6e6f5] leading-none mt-1 select-none">
                  02
                </span>
                <div>
                  <h3 className="font-semibold mb-1">Enfrenta la entrevista</h3>
                  <p className="text-[#6b7280] text-sm leading-relaxed">
                    El agente te hará preguntas técnicas y de soft skills en
                    inglés, como lo haría un entrevistador real.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <span className="text-3xl font-bold text-[#d6e6f5] leading-none mt-1 select-none">
                  03
                </span>
                <div>
                  <h3 className="font-semibold mb-1">Revisa tu desempeño</h3>
                  <p className="text-[#6b7280] text-sm leading-relaxed">
                    Al terminar recibes una transcripción completa y un resumen
                    generado por IA con observaciones y áreas de mejora.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Por qué en inglés */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[#5b7fbf] mb-4">
            Por qué en inglés
          </p>
          <h2 className="text-3xl font-bold mb-6">
            El idioma que abre puertas en tech
          </h2>
          <p className="text-[#6b7280] leading-relaxed mb-6">
            La mayoría de las empresas de tecnología —incluidas las remotas y
            las internacionales— realizan sus procesos de selección en inglés.
            Muchos candidatos con las habilidades técnicas suficientes no pasan
            por no poder comunicarlas con claridad.
          </p>
          <p className="text-[#6b7280] leading-relaxed">
            Agora te entrena para estructurar y expresar tus respuestas en
            inglés técnico bajo presión, antes de que llegues a la entrevista
            real.
          </p>
        </div>
        <div className="relative h-[380px] rounded-2xl overflow-hidden shadow-lg">
          <Image
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&q=85"
            alt="Profesionales colaborando en tecnología"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#5b7fbf]/20 to-transparent" />
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[#5b7fbf]">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Tu próxima entrevista empieza aquí
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              Regístrate con tu correo institucional del IPN, elige el rol al
              que quieres aplicar y comienza a practicar cuando quieras.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/sign-up"
                className="text-base font-semibold bg-white text-[#5b7fbf] px-7 py-3 rounded-xl hover:bg-blue-50 transition-colors text-center"
              >
                Acceder con correo institucional
              </Link>
              <Link
                href="/sign-in"
                className="text-base font-semibold border border-white text-white px-7 py-3 rounded-xl hover:bg-white/10 transition-colors text-center"
              >
                Iniciar sesión
              </Link>
            </div>
            <p className="text-blue-200 text-xs mt-4">
              Requiere correo <span className="font-medium">@alumno.ipn.mx</span>
            </p>
          </div>
          <div className="relative h-[320px] rounded-2xl overflow-hidden shadow-xl">
            <Image
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=85"
              alt="Profesional de tecnología"
              fill
              className="object-cover object-top"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] py-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#6b7280]">
          <span className="font-bold text-[#5b7fbf]">Agora</span>
          <div className="flex items-center gap-6">
            <Link
              href="/sign-in"
              className="hover:text-[#5b7fbf] transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/sign-up"
              className="hover:text-[#5b7fbf] transition-colors"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
