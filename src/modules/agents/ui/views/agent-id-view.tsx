"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { VideoIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  agentId: string;
}

export const AgentIdView = ({ agentId }: Props) => {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");

  const { data } = useSuspenseQuery(
    trpc.agents.getOne.queryOptions({ id: agentId })
  );

  const createMeeting = useMutation(
    trpc.meetings.create.mutationOptions({
      onSuccess: async (meeting) => {
        await queryClient.invalidateQueries(
          trpc.meetings.getMany.queryOptions({})
        );
        router.push(`/call/${meeting.id}`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleOpenDialog = () => {
    setSessionName(
      `Práctica de ${data.role} — ${format(new Date(), "d 'de' MMMM", { locale: es })}`
    );
    setDialogOpen(true);
  };

  const handleStartSession = () => {
    if (!sessionName.trim()) return;
    createMeeting.mutate({ name: sessionName.trim(), agentId });
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar entrevista de práctica</DialogTitle>
            <DialogDescription>
              Puedes editar el nombre de la entrevista antes de comenzar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Nombre de la entrevista "
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStartSession();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleStartSession}
                disabled={createMeeting.isPending || !sessionName.trim()}
              >
                {createMeeting.isPending ? "Iniciando..." : "Comenzar entrevista "}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-4">
        <div className="flex items-center gap-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agentes">
              <ChevronLeftIcon className="size-4" />
              Volver
            </Link>
          </Button>
        </div>
        <div className="bg-white rounded-xl border p-6 flex flex-col gap-y-6">
          <div className="flex items-center gap-x-4">
            <GeneratedAvatar
              variant="botttsNeutral"
              seed={data.name}
              className="size-16"
            />
            <div>
              <h2 className="text-2xl font-semibold">{data.role}</h2>
              <p className="text-muted-foreground text-sm">{data.name}</p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="flex items-center gap-x-2 w-fit [&>svg]:size-4"
          >
            <VideoIcon className="text-blue-500" />
            {data.meetingCount}{" "}
            {data.meetingCount === 1 ? "entrevista practicada" : "entrevistas practicadas"}
          </Badge>

          <div className="flex flex-col gap-y-2">
            <p className="text-sm font-medium">Especialidad</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.description}
            </p>
          </div>

          <div className="flex flex-col gap-y-2">
            <p className="text-sm font-medium">Sobre este entrevistador</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Este agente conduce entrevistas técnicas y de habilidades blandas
              completamente en inglés, simulando un proceso de selección real
              para el rol de{" "}
              <span className="font-medium text-foreground">{data.role}</span>.
              Hará preguntas técnicas relevantes al puesto y no se saldrá del
              contexto de la entrevista.
            </p>
          </div>

          <div className="pt-2">
            <Button onClick={handleOpenDialog}>
              <VideoIcon className="size-4" />
              Iniciar entrevista de práctica
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export const AgentsIdViewLoading = () => {
  return (
    <LoadingState
      title="Cargando agente"
      description="Esto puede tomar unos segundos"
    />
  );
};

export const AgentsIdViewError = () => {
  return (
    <ErrorState
      title="Error al cargar agente"
      description="Intenta de nuevo más tarde"
    />
  );
};
