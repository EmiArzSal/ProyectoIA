import React from 'react'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { GeneratedAvatar } from '@/components/ui/generated-avatar';
import Link from 'next/link';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { ChevronsUpDownIcon } from 'lucide-react';

export const DashboardUserButton = () => {
  const { data, isPending } = authClient.useSession();
  const userName = data?.user?.name ?? 'Usuario';
  const userEmail = data?.user?.email ?? 'unknown@email.com';

  if (isPending || !data?.user) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          asChild
          tooltip={userName}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Link href="/dashboard/settings">
            {data.user.image ? (
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={data.user.image} alt={userName} />
              </Avatar>
            ) : (
              <GeneratedAvatar seed={userName} variant="initials" className="size-8 rounded-lg" />
            )}
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{userName}</span>
              <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};