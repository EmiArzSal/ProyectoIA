"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { DashboardUserButton } from "./dashboard-user-button"
import {
  BotIcon,
  VideoIcon,
  LayoutDashboardIcon,
  BookMarkedIcon,
  LibraryIcon,
  TrophyIcon,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"

const navigationItems = [
  {
    icon: LayoutDashboardIcon,
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    icon: VideoIcon,
    label: "Historial",
    href: "/meetings",
  },
  {
    icon: BotIcon,
    label: "Entrevistadores",
    href: "/agentes",
  },
  {
    icon: BookMarkedIcon,
    label: "Correcciones",
    href: "/corrections",
  },
  {
    icon: LibraryIcon,
    label: "Glosario",
    href: "/glossary",
  },
  {
    icon: TrophyIcon,
    label: "Logros",
    href: "/achievements",
  },
]

export function DashboardSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Image
                    src="/logo.png"
                    alt="Agora"
                    width={24}
                    height={24}
                    className="size-6 object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-base">Agora</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Entrevistas tech
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export default DashboardSidebar