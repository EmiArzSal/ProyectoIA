import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VideoIcon } from "lucide-react";

interface Props {
  meetingId: string;
}

export const ActiveState = ({ meetingId }: Props) => {
  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
        <EmptyState
        image="/upcoming.svg"
        title="Sesión en curso"
        description="La sesión terminará una vez que todos los participantes se hayan desconectado"
        />
      <div className="flex flex-col-reverse gap-2 items-center lg:flex-row lg:justify-center w-full">
        <Button variant="default" size="icon" className="w-full lg:w-auto px-6" asChild>
          <Link href={`/call/${meetingId}`}>
            <VideoIcon/>
            Unirse a la sesión
          </Link>
        </Button>
      </div>
    </div>
  );
};
