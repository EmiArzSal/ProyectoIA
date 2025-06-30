"use client";
import { MeetingGetOne } from "../../types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpenTextIcon, SparklesIcon, FileTextIcon, FileVideoIcon, ClockFadingIcon } from "lucide-react";
import Markdown from "react-markdown"
import Link from "next/link";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import { Transcript } from "./transcript";
import { ChatProvider } from "./chat-provider";

interface Props{
  data: MeetingGetOne
}

export const CompletedState = ({ data }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="summary">
        <div className="">
          <ScrollArea>
            <TabsList className="">
              <TabsTrigger 
                value="summary"
                className="text-black rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-black h-full hover:text-black cursor-pointer"  
              >
                <BookOpenTextIcon/>
                Resumen
              </TabsTrigger>
              <TabsTrigger 
                value="transcript"
                className="text-black rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-black h-full hover:text-black cursor-pointer"  
              >
                <FileTextIcon/>
                Transcripción
              </TabsTrigger>
              <TabsTrigger 
                value="recording"
                className="text-black rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-black h-full hover:text-black cursor-pointer"  
              >
                <FileVideoIcon/>
                Grabación
              </TabsTrigger>
              <TabsTrigger 
                value="chat"
                className="text-black rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-black h-full hover:text-black cursor-pointer"  
              > 
                <SparklesIcon/>
                Chat IA
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        <TabsContent value="chat">
          <ChatProvider meetingId={data.id} meetingName={data.name} />
        </TabsContent>
        <TabsContent value="transcript">
          <Transcript meetingId={data.id} />
        </TabsContent>
        <TabsContent value="recording">
          <div className="bg-white rounded-lg border px-4 py-5">
            <video 
              src={data.recordingUrl!}
              className="w-full rounded-lg" 
              controls
            />
          </div>
        </TabsContent>
        <TabsContent value="summary">
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
              <h2 className="text-2xl font-medium capitalize">{data.name}</h2>
              <div className="flex items-center gap-x-2">
                <Link href={`/agentes/${data.agentId}`} className="flex items-center gap-x-2 underline underline-offset-4 capitalize">
                  <GeneratedAvatar 
                    seed={data.agent.name}
                    variant="botttsNeutral"
                    className="size-6"
                  />
                  {data.agent.name}
                </Link>{" "}
                <p>{data.startedAt ? format(data.startedAt, "PPP", { locale: es }) : " "}</p>
              </div>
              <div className="flex items-center gap-x-2">
                <SparklesIcon className="size-4 text-primary"/>
                <p>
                  Resumen general
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-x-2 [&>svg]:size-4">
                <ClockFadingIcon className="text-blue-700"/>  
                {data.duration ? formatDuration(data.duration) : "Sin duracion"}
                </Badge>
                <div>
                  <Markdown
                    components={{
                      h1: (props) => (<h1 className="text-2xl font-medium mb-6" {...props} />),
                      h2: (props) => (<h2 className="text-xl font-medium mb-4" {...props} />),
                      h3: (props) => (<h3 className="text-lg font-medium mb-3" {...props} />),
                      h4: (props) => (<h4 className="text-base font-medium mb-2" {...props} />),
                      p: (props) => (<p className="mb-6 leading-relaxed" {...props} />),
                      ul: (props) => (<ul className="mb-6 list-disc list-inside" {...props} />),
                      ol: (props) => (<ol className="mb-6 list-decimal list-inside" {...props} />),
                      li: (props) => (<li className="mb-1" {...props} />),
                      strong: (props) => (<strong className="font-semibold" {...props} />),
                      code: (props) => (<code className="bg-gray-100 px-1 py-0.5 rounded" {...props} />),
                      blockquote: (props) => (<blockquote className="border-l-4 pl-4 italic my-4" {...props} />),
                    }}
                  >
                    {data.summary}
                  </Markdown>
                </div>
            </div>
          </div>
      </TabsContent>
      </Tabs>
    </div>
  )
};
