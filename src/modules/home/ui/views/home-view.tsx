"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  VideoIcon, 
  MessageSquareIcon, 
  UsersIcon, 
  CalendarIcon,
  SparklesIcon,
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
          Gestiona tus sesiones inteligentes y obtén insights valiosos con la ayuda de la IA
        </p>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/meetings">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <VideoIcon className="size-5 text-blue-600" />
                <CardTitle className="text-lg">Nueva Sesión</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Crea una nueva sesión con tu agente de IA personalizado
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/agentes">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <UsersIcon className="size-5 text-green-600" />
                <CardTitle className="text-lg">Mis Agentes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gestiona y personaliza tus asistentes de IA
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/meetings">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <CalendarIcon className="size-5 text-purple-600" />
                <CardTitle className="text-lg">Sesiones</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Revisa el historial y resultados de tus sesiones
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/meetings">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-x-2">
                <MessageSquareIcon className="size-5 text-orange-600" />
                <CardTitle className="text-lg">Chat IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Continúa conversando con tus asistentes
              </CardDescription>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sesiones</CardTitle>
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
            <CardTitle className="text-sm font-medium">Agentes Activos</CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.activeAgents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.thisMonthAgents ? `+${stats.thisMonthAgents} este mes` : "Sin nuevos agentes"}
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
              <SparklesIcon className="size-5 text-blue-600" />
              Asistentes de IA Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nuestros agentes de IA están diseñados para asistirte en sesiones, 
              tomar notas, generar resúmenes y responder preguntas en tiempo real.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Transcripción automática</Badge>
              <Badge variant="secondary">Resúmenes inteligentes</Badge>
              <Badge variant="secondary">Chat posterior</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <TrendingUpIcon className="size-5 text-green-600" />
              Análisis y Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Obtén insights valiosos de tus sesiones con análisis automático, 
              seguimiento de temas y recomendaciones personalizadas.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Seguimiento de temas</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold">¿Listo para tu primera sesión con IA?</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Crea tu primer agente personalizado y comienza a experimentar 
              el poder de la IA en tus sesiones.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link href="/meetings">
                  Crear Sesión
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/agentes">
                  Ver Agentes
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
