"use client"

import React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { DashboardUserButton } from './dashboard-user-button'
import { BotIcon, ChevronRight, Icon, StarIcon, VideoIcon } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { usePathname } from 'next/navigation'

const firstSection = [
  {
    icon: VideoIcon,
    label: 'Sesiones',
    href: '/meetings'
  },
  {
    icon: BotIcon,
    label: 'Agentes',
    href: '/agentes'
  }
]

const secondSection = [
  {
    icon: StarIcon,
    label: 'Actualizar',
    href: '/upgrade'
  },
]

function DashboardSidebar() {
  const pathname = usePathname()
  return (
    <Sidebar className="border-none shadow-xl">
      <SidebarHeader className='text-sidebar-accent-foreground'>
        <Link href='/' className='flex items-center gap-2 px-2 pt-2'> 
          <Image src='/logo.png' alt='Agora' width={56} height={56} />
          <p className='text-2xl font-semibold'>Agora</p>
        </Link>
      </SidebarHeader>
      <div className='px-4 py-2 '>
        <Separator className='opacity-10 text-[#5D6B68]' />
      </div>
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {firstSection.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return(
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild className={cn("group relative h-14 px-4 rounded-xl transition-all duration-300 hover:shadow-md",
                          "bg-white/50 hover:bg-white/80 border border-transparent",
                          "hover:border-primary/20 hover:scale-[1.02]", isActive && [
                            "bg-gradient-to-r from-primary/15 to-secondary/15",
                            "border-primary/30 shadow-lg scale-[1.02]",
                            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2", "hover:text-accent hover:scale-110",
                            "before:w-1 before:h-8 before:bg-gradient-to-b before:from-primary before:to-secondary before:rounded-r-full",
                          ],
                          )} isActive={isActive}>
                    <Link href={item.href} className="flex items-center gap-4 w-full">
                      <div className={cn(
                              "p-2.5 rounded-lg transition-all duration-300",
                              "hover:text-accent",
                              isActive && "from-primary/30 to-secondary/30")}>
                        <item.icon className={cn("size-5 transition-all duration-300",isActive ? "text-accent" : "text-muted-foreground"
                        )}/>
                      </div>
                      <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-semibold transition-colors duration-300",
                                isActive ? "text-primary" : "text-foreground" 
                              )}
                            >
                              {item.label}
                            </p>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className='px-4 py-2 '>
          <Separator className='opacity-10 text-[#5D6B68]' />
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {secondSection.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return(
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild className={cn("group relative h-14 px-4 rounded-xl transition-all duration-300 hover:shadow-md",
                          "bg-white/50 hover:bg-white/80 border border-transparent",
                          "hover:border-primary/20 hover:scale-[1.02]", isActive && [
                            "bg-gradient-to-r from-primary/15 to-secondary/15",
                            "border-primary/30 shadow-lg scale-[1.02]",
                            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2", "hover:text-accent hover:scale-110",
                            "before:w-1 before:h-8 before:bg-gradient-to-b before:from-primary before:to-secondary before:rounded-r-full",
                          ],
                          )} isActive={isActive}>
                    <Link href={item.href} className="flex items-center gap-4 w-full">
                      <div className={cn(
                              "p-2.5 rounded-lg transition-all duration-300",
                              "hover:text-accent",
                              isActive && "from-primary/30 to-secondary/30")}>
                        <item.icon className={cn("size-5 transition-all duration-300",isActive ? "text-accent" : "text-muted-foreground"
                        )}/>
                      </div>
                      <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-semibold transition-colors duration-300",
                                isActive ? "text-primary" : "text-foreground" 
                              )}
                            >
                              {item.label}
                            </p>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className='text-sidebar-accent-foreground'>
        <DashboardUserButton/>
      </SidebarFooter>
    </Sidebar>
  )
}

export default DashboardSidebar