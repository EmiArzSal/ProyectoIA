import React from 'react'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { GeneratedAvatar } from '@/components/ui/generated-avatar';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const DashboardUserButton = () => {
  const { data, isPending } = authClient.useSession();
  const userName = data?.user?.name ?? 'Usuario';
  const userEmail = data?.user?.email ?? 'unknown@email.com';

  if(isPending || !data?.user){
    return null;
  }

  const buttonClasses = cn(
    'rounded-lg border border-border/10 p-3 w-full flex items-center justify-between overflow-hidden bg-white hover:bg-gray-100 transition-colors cursor-pointer'
  );

  return (
    <Link href='/dashboard/settings' className={buttonClasses}>
      {data.user.image ? (
        <Avatar>
          <AvatarImage src={data.user.image}/>
        </Avatar>
      ) : (
        <GeneratedAvatar seed={userName} variant='initials' className='size-9 mr-3' />
      )}
      <div className='flex flex-col gap-0.5 text-left overflow-hidden flex-1 min-w-0 ml-2'>
        <p className='text-sm truncate w-full font-semibold text-foreground'>
          {userName}
        </p>
        <p className='text-xs truncate w-full text-muted-foreground'>
          {userEmail}
        </p>
      </div>
      <svg className='size-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
      </svg>
    </Link>
  );
};