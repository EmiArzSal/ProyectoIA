"use client";

import { ErrorState } from "@/components/error-state";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CallProvider } from "../components/call-provider";


interface Props {
  meetingId: string;
}

export const CallView = ({ meetingId }: Props) => {
  const trpc = useTRPC();
  const {data} = useSuspenseQuery(
    trpc.meetings.getOne.queryOptions({id: meetingId}),
  );

  if(data.status === "completed"){
    return (<div className="flex h-screen items-center justify-center">
      <ErrorState
        title="La sesión ha finalizado"
        description="Ya no puedes unirte a la sesión"
      />

    </div>
    );
  }

  if(data.status === "cancelled"){
    return <div>CallView</div>;
  }

  return (
    <CallProvider meetingId={meetingId} meetingName={data.name} />
  );
};
