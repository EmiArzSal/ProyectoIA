"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  VideoIcon, 
  CalendarIcon,
  TrendingUpIcon,
  ClockIcon,
  CheckCircleIcon
} from "lucide-react";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export const HomeView = () => {
  const trpc = useTRPC();
  
  const { data: stats, isLoading } = useQuery(
    trpc.meetings.getStats.queryOptions()
  );

  // Función para formatear el tiempo en horas y minutos
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Función para calcular el porcentaje de completación
  const getCompletionRate = () => {
    if (!stats || stats.totalMeetings === 0) return 0;
    return Math.round((stats.completedMeetings / stats.totalMeetings) * 100);
  };
  
  return (
    <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-6">
      {/* Header */}
      <div className="flex flex-col gap-y-2">
        <h1 className="text-3xl font-bold">¡Bienvenido a Agora!</h1>
        <p className="text-muted-foreground">
          Prepárate para entrevistas técnicas en inglés y mejora tus habilidades en IT
        </p>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/meetings">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <VideoIcon className="size-5 text-blue-600" />
                <CardTitle className="text-lg">Nueva Entrevista IT</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Practica entrevistas técnicas en inglés con nuestros entrevistadores especializados
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/meetings">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <CalendarIcon className="size-5 text-purple-600" />
                <CardTitle className="text-lg">Mis Entrevistas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Revisa tus entrevistas completadas, retroalimentación y progreso
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/corrections">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <CheckCircleIcon className="size-5 text-green-600" />
                <CardTitle className="text-lg">Correcciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Accede a las correcciones y mejoras sugeridas en tus entrevistas
              </CardDescription>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entrevistas</CardTitle>
            <VideoIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.totalMeetings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.thisWeekMeetings ? `+${stats.thisWeekMeetings} esta semana` : "Sin actividad"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrevistas Esta Semana</CardTitle>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.thisWeekMeetings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Entrevistas completadas recientemente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Total</CardTitle>
            <ClockIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatTime(stats?.totalTimeSeconds || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.thisWeekTimeSeconds ? `+${formatTime(stats.thisWeekTimeSeconds)} esta semana` : "Sin tiempo registrado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircleIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.completedMeetings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {getCompletionRate()}% tasa de éxito
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Características principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <VideoIcon className="size-5 text-blue-600" />
              Entrevistas Técnicas en Inglés
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Practica entrevistas técnicas reales para puestos entry level en IT.
              Nuestros entrevistadores especializados te guiarán a través de preguntas
              técnicas y evaluarán tu nivel de inglés profesional.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Preguntas técnicas reales</Badge>
              <Badge variant="secondary">Evaluación de inglés</Badge>
              <Badge variant="secondary">Retroalimentación inmediata</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <TrendingUpIcon className="size-5 text-green-600" />
              Análisis y Retroalimentación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Obtén análisis detallados de tu desempeño técnico y nivel de inglés.
              Recibe recomendaciones personalizadas para mejorar tus habilidades
              y aumentar tus oportunidades laborales.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Resúmenes detallados</Badge>
              <Badge variant="secondary">Correcciones gramaticales</Badge>
              <Badge variant="secondary">Consejos de mejora</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold">¿Listo para tu primera entrevista técnica?</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Comienza a practicar entrevistas en inglés para puestos entry level en IT.
              Obtén retroalimentación valiosa sobre tus conocimientos técnicos y nivel de inglés.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link href="/meetings">
                  Comenzar Entrevista
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/corrections">
                  Ver Retroalimentación
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
