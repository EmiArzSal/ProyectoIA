import { createAvatar } from '@dicebear/core';
import { botttsNeutral, initials } from '@dicebear/collection';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMemo } from 'react';

interface GeneratedAvatarProps {
  seed: string;
  className?: string;
  variant?: 'botttsNeutral' | 'initials';
}

export const GeneratedAvatar = ({
  seed,
  className,
  variant = 'botttsNeutral',
}: GeneratedAvatarProps) => {

  const avatar = useMemo(() => {
    return variant === 'botttsNeutral'
      ? createAvatar(botttsNeutral, { seed })
      : createAvatar(initials, { seed, fontWeight:500, fontSize:42 });
  }, [seed, variant]);

  return (
    <Avatar className={cn(className)}>
      <AvatarImage
        src={avatar.toDataUri()}
        alt="Generated Avatar"
      />
      <AvatarFallback>{seed.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}