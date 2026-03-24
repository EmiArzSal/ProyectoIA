import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsView } from "@/modules/dashboard/ui/views/settings-view";

const SettingsPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return <SettingsView user={session.user} />;
};

export default SettingsPage;
