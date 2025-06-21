import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VideoIcon, BanIcon } from "lucide-react";

interface Props {
  meetingId: string;
  onCancelMeeting: () => void;
  isCancelling: boolean;
}

export const UpcomingState = ({ meetingId, onCancelMeeting, isCancelling }: Props) => {
  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
        <EmptyState
        image="/upcoming.svg"
        title="Aún no hay reuniones programadas"
        description="Cuando una reunión sea programada, aparecerá aquí"
        />
      <div className="flex flex-col-reverse gap-2 items-center lg:flex-row lg:justify-center w-full">
        <Button variant="outline" size="icon" className="w-full lg:w-auto" onClick={onCancelMeeting} disabled={isCancelling}>
          <BanIcon/>
          Cancelar reunión
        </Button>
        <Button variant="default" size="icon" className="w-full lg:w-auto" disabled={isCancelling} asChild>
          <Link href={`/call/${meetingId}`}>
            <VideoIcon/>
            Iniciar reunión
          </Link>
        </Button>
      </div>
    </div>
  );
};
