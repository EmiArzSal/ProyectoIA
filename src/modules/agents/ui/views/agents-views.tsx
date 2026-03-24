"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const AgentsView = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.agents.getMany.queryOptions());

  return (
    <div className="flex-1 p-4 px-4 md:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((agent) => (
          <button
            key={agent.id}
            onClick={() => router.push(`/agentes/${agent.id}`)}
            className="text-left bg-white border border-border rounded-xl p-5 hover:border-primary hover:shadow-md transition-all group flex flex-col gap-y-4"
          >
            <div className="flex items-center gap-x-3">
              <GeneratedAvatar
                variant="botttsNeutral"
                seed={agent.name}
                className="size-12 shrink-0"
              />
              <div>
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {agent.role}
                </p>
                <p className="text-xs text-muted-foreground">{agent.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {agent.description}
            </p>
            <Badge
              variant="outline"
              className="flex items-center gap-x-1.5 w-fit text-xs"
            >
              <VideoIcon className="size-3 text-blue-500" />
              {agent.meetingCount}{" "}
              {agent.meetingCount === 1 ? "entrevista " : "entrevistas"}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
};

export const AgentsViewLoading = () => {
  return (
    <LoadingState
      title="Cargando agentes"
      description="Esto puede tomar unos segundos"
    />
  );
};

export const AgentsViewError = () => {
  return (
    <ErrorState
      title="Error al cargar agentes"
      description="Intenta de nuevo más tarde"
    />
  );
};
