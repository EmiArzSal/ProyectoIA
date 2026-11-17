"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoIcon, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export const AgentsView = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.agents.getMany.queryOptions());

  return (
    <div className="flex-1 p-4 px-4 md:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className="w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => router.push(`/agentes/${agent.id}`)}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow group h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <GeneratedAvatar
                      variant="botttsNeutral"
                      seed={agent.name}
                      className="size-12 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        {agent.role}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        {agent.name}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {agent.description}
                </p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <VideoIcon className="size-3" />
                    {agent.meetingCount}{" "}
                    {agent.meetingCount === 1 ? "entrevista" : "entrevistas"}
                  </Badge>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </CardContent>
            </Card>
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
