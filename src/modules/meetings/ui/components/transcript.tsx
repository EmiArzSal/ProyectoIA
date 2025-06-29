import { useState } from "react";
import { format } from "date-fns";
import { SearchIcon } from "lucide-react";
import Highlighter from "react-highlight-words";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { generateAvatarUri } from "@/lib/avatar";

interface Props {
  meetingId: string;
}

export const Transcript = ({ meetingId }: Props) => {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.meetings.getTranscript.queryOptions({id: meetingId}));
  const [seachQuery, setSeachQuery] = useState("");
  const filteredData = (data ?? []).filter((item) => {
    return item.text.toLowerCase().includes(seachQuery.toLowerCase());
  });
  return (
    <div className="flex flex-col gap-y-4 bg-white rounded-lg border px-4 py-5 w-full">
      <p className="text-sm font-medium">Transcripción</p>
      <div className="relative">
        <Input
          placeholder="Buscar en la transcripción"
          className="pl-7 h-9 w-[240px]"
          value={seachQuery}
          onChange={(e) => setSeachQuery(e.target.value)}
        />
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      </div>
      <ScrollArea className="h-[300px]">
        <div className="flex flex-col gap-y-4">
          {filteredData.map((item) => {
            return (
              <div
                key={item.start_ts}
                className="flex flex-col gap-y-2 hover:bg-muted p-4 rounded-md border"
              >
                <div className="flex items-center gap-x-2">
                  <Avatar className="size-6">
                    <AvatarImage 
                      src={item.user.image ?? generateAvatarUri({seed: item.user.name, variant: "initials" })} 
                      alt="Avatar del usuario"
                    />
                  </Avatar>
                  <span className="font-medium text-sm">{item.user.name}</span>
                  <span className="text-sm text-blue-500 font-medium">{format(new Date(0,0,0,0,0,0, item.start_ts), "mm:ss")}</span>
                </div>
                <Highlighter
                  highlightClassName="bg-yellow-200"
                  className="text-sm text-neutral-700"
                  searchWords={[seachQuery]}
                  textToHighlight={item.text}
                  autoEscape={true}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}