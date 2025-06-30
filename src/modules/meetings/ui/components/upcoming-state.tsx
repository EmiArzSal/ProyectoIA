import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VideoIcon } from "lucide-react";

interface Props {
  meetingId: string;
}

export const UpcomingState = ({ meetingId }: Props) => {
  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
        <EmptyState
        image="/upcoming.svg"
        title="Aún no hay reuniones programadas"
        description="Cuando una reunión sea programada, aparecerá aquí"
        />
      <div className="flex flex-col-reverse gap-2 items-center lg:flex-row lg:justify-center w-full">
        <Button variant="default" size="icon" className="w-full lg:w-auto" asChild>
          <Link href={`/call/${meetingId}`}>
            <VideoIcon/>
            Iniciar reunión
          </Link>
        </Button>
      </div>
    </div>
  );
};
