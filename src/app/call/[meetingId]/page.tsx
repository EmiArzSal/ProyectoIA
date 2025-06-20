import { db } from "@/db";
import { meetings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { MeetingIdView } from "@/modules/meetings/ui/views/meeting-id-view";
import { HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CallView } from "@/modules/call/ui/views/call-view";

interface Props {
  params: Promise<{
    meetingId: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const {meetingId} = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if(!session){
    redirect("/sign-in");
  }
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.meetings.getOne.queryOptions({id: meetingId}),
  );
  const dehydratedState = dehydrate(queryClient);
  return (
    <HydrationBoundary state={dehydratedState}>
      <CallView meetingId={meetingId} />
    </HydrationBoundary>
  );
};

export default Page;