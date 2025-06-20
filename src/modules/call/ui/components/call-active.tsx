import Link from "next/link";
import Image from "next/image";
import { CallControls, SpeakerLayout } from "@stream-io/video-react-sdk";


interface Props{
  onLeave: () => void;
  meetingName: string;
}

export const CallActive = ({ onLeave, meetingName }: Props) => {
  return (
    <div className="flex flex-col h-full justify-between p-4 text-slate-800">
      <div className="bg>[#101213] rounded-full p-4 flex items-center gap-4">
        <Link href="/" className="flex items-center justify-center p-1 bg-white rounded-full w-fit">
          <Image src="/logo.png" alt="logo" width={26} height={26} />
        </Link>
          <h4 className='text-base'>
            {meetingName}
          </h4>
      </div>
      <SpeakerLayout />
      <div className='bg-gray-100 rounded-full px-4'>
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
};