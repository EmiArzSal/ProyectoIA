import { Suspense } from "react";
import { EmailVerifiedView } from "@/modules/auth/ui/views/email-verified-view";

export default function EmailVerifiedPage() {
  return (
    <Suspense>
      <EmailVerifiedView />
    </Suspense>
  );
}
