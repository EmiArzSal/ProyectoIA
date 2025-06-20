"use client";

import { Button } from "@/components/ui/button";
import { LogInIcon } from "lucide-react";
import {
  DefaultVideoPlaceholder,
  StreamVideoParticipant,
  ToggleAudioPreviewButton,
  ToggleVideoPreviewButton,
  useCallStateHooks,
  VideoPreview,
} from "@stream-io/video-react-sdk";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { generateAvatarUri } from "@/lib/avatar";
import "@stream-io/video-react-sdk/dist/css/styles.css";

interface Props {
  onJoin: () => void;
}
const DisabledVideoPreview = () => {
  const { data } = authClient.useSession();
  return (
    <DefaultVideoPlaceholder
      participant={
        {
          name: data?.user.name ?? "Desconocido",
          image: 
            data?.user.image ??
            generateAvatarUri({
              seed: data?.user.name ?? "",
              variant: "initials",
            }),
      } as StreamVideoParticipant
      }
      />
  );
};

const AllowBrowserPermissions = () => {
  return (
    <p className="text-sm">
      Por favor, permite el acceso a tu cámara y micrófono para unirte a la llamada.
    </p>
  )
}


export const CallLobby = ({ onJoin }: Props) => {
  const { useCameraState, useMicrophoneState } = useCallStateHooks();
  const { hasBrowserPermission: hasCameraPermission } = useCameraState();
  const { hasBrowserPermission: hasMicPermission } = useMicrophoneState();
  const hasBrowserMediaPermissions = hasCameraPermission && hasMicPermission;
  return (
    <div className="flex flex-col justify-center items-center h-full bg-radial from-sidebar to-sidebar-accent">
      <div className="py-4 px-8 flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg shadow-sm p-10">
          <div className="flex flex-col gap-y-2 text-center">
            <h6 className="text-lg font-medium">¿Listo para unirte a la llamada?</h6>
            <p className="text-sm">
              Prepara la llamada antes de unirte.
            </p>
          </div>
          <VideoPreview
            DisabledVideoPreview={hasBrowserMediaPermissions ? DisabledVideoPreview : AllowBrowserPermissions}
          />
          <div className="flex gap-x-2">
            <ToggleAudioPreviewButton />
            <ToggleVideoPreviewButton />
          </div>
          <div className="flex gap-x-2 justify-between w-full">
            <Button variant="ghost" asChild>
              <Link href="/meetings">
                Cancelar
              </Link>
            </Button>
            <Button onClick={onJoin}>
              Unirse a la llamada
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};