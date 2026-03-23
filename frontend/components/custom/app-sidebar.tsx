"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import {
  ChartBar,
  Key,
  Database,
  Gear,
  SignOut,
  CaretUpDown,
  UserCircle,
  ActivityIcon,
  Book,
} from "@phosphor-icons/react";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { fetchProjects } from "@/lib/store/features/projectsSlice";
import Link from "next/link";

type UserProps = {
  user: {
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    org_id?: string | null;
    [key: string]: any;
  };
};

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: ChartBar,
  },
  {
    title: "Events Log",
    url: "/events",
    icon: ActivityIcon,
  },
  {
    title: "Organizations",
    url: "/organizations",
    icon: Database,
  },
  {
    title: "API Keys",
    url: "/api-keys",
    icon: Key,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Gear,
  },
  {
    title: "Docs",
    url: "/docs",
    icon: Book,
  },
];

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & UserProps) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();

  const dispatch = useAppDispatch();
  const { status, lastFetchedOrgId } = useAppSelector(
    (state) => state.projects,
  );

  useEffect(() => {
    if (user?.org_id) {
      if (lastFetchedOrgId !== user.org_id) {
        dispatch(fetchProjects(user.org_id as string));
      }
    }
  }, [user, dispatch, lastFetchedOrgId]);

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10" {...props}>
      <SidebarHeader className="border-b border-white/5 pb-4 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-white/5 cursor-default"
            >
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-zinc-100">
                  Trackly
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-zinc-500">
            Platform
          </SidebarGroupLabel>
          <SidebarMenu className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className={
                      isActive
                        ? "border-2 border-black bg-white px-5 py-2 font-semibold text-black shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0 h-auto"
                        : "hover:bg-white/5 text-zinc-300 hover:text-white py-3 h-auto"
                    }
                  >
                    <Link href={item.url}>
                      <item.icon
                        weight={isActive ? "fill" : "duotone"}
                        className={
                          isActive
                            ? "text-black size-5"
                            : "text-zinc-400 size-5"
                        }
                      />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 pt-4 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-white/5"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user.picture || ""}
                      alt={user.name || "User"}
                    />
                    <AvatarFallback className="rounded-lg text-xs bg-transparent text-zinc-400">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-zinc-200">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-zinc-500">
                      {user.email}
                    </span>
                  </div>
                  <CaretUpDown size={16} className="ml-auto text-zinc-500" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-[#141418] border border-white/10 text-zinc-200"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user.picture || ""}
                        alt={user.name || "User"}
                      />
                      <AvatarFallback className="rounded-lg text-xs">
                        {user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-zinc-500">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer">
                    <UserCircle size={16} className="mr-2" />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer">
                    <Gear size={16} className="mr-2" />
                    Preferences
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    asChild
                    className="hover:bg-red-500/20 focus:bg-red-500/20 text-red-400 focus:text-red-300 cursor-pointer"
                  >
                    <a href="/auth/logout" className="flex items-center w-full">
                      <SignOut size={16} className="mr-2" />
                      Log out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
