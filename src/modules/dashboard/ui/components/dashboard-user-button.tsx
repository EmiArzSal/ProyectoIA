import React from 'react'
import { authClient } from '@/lib/auth-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { GeneratedAvatar } from '@/components/ui/generated-avatar';
import { ChevronDownIcon, LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const DashboardUserButton = () => {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const userName = data?.user?.name ?? 'Usuario';
  const userEmail = data?.user?.email ?? 'unknown@email.com';
  const onLogout = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          // Optionally handle success, e.g., redirect to login page
          router.push('/sign-in');
        }
      }
    });
  }
  if(isPending || !data?.user){
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='rounded-lg border border-border/10 p-3 w-full flex items-center justify-between overflow-hidden bg-black/5 hover:bg-black/10'>
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
          <ChevronDownIcon className='size-4 shrink-0'/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' side='right' className='w-72'>
        <DropdownMenuLabel>
          <div className='flex flex-col gap-1'>
            <span className='font-medium truncate'>{userName}</span>
            <span className='text-sm text-normal truncate text-muted-foreground'>
              {userEmail}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className='cursor-pointer flex items-center justify-between'>
          Logout
          <LogOutIcon className='size-4'/>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}