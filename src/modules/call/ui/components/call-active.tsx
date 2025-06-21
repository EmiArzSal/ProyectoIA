import Link from "next/link";
import Image from "next/image";
import { CallControls, SpeakerLayout } from "@stream-io/video-react-sdk";


interface Props{
  onLeave: () => void;
  meetingName: string;
}

export const CallActive = ({ onLeave, meetingName }: Props) => {
  return (
    <div className="flex flex-col h-full justify-between p-4 text-white">
      <div className="bg>[#c5c5c5] rounded-full p-4 flex items-center gap-4">
        <Link href="/" className="flex items-center justify-center p-1 bg-white rounded-full w-fit">
          <Image src="/logo.png" alt="logo" width={50} height={50} />
        </Link>
          <h3 className='text-base text-black'>
            {meetingName}
          </h3>
      </div>
      <SpeakerLayout />
      <div className='bg-gray-200 rounded-full px-4'>
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
};