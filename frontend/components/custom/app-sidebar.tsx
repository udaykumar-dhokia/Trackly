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
  Users,
  Monitor,
} from "@phosphor-icons/react";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchProjects,
  setActiveProject,
  fetchUserOrgs,
  setActiveOrg,
} from "@/lib/store/features/projectsSlice";
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
  const {
    items: projects,
    activeProjectId,
    organizations,
    activeOrgId,
  } = useAppSelector((state) => state.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  useEffect(() => {
    if (user?.sub) {
      dispatch(fetchUserOrgs(user.sub));
    }
  }, [user?.sub, dispatch]);

  useEffect(() => {
    if (activeOrgId) {
      dispatch(fetchProjects(activeOrgId));
    }
  }, [activeOrgId, dispatch]);

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10" {...props}>
      <SidebarHeader className="border-b border-white/5 pb-6 pt-6 px-4">
        <div className="flex items-center gap-3 px-2 space-y-1">
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-white leading-none">
              Trackly
            </span>
            <span className="text-[9px] text-zinc-500 font-mono tracking-[0.2em] mt-1">
              Zero-overhead AI tracking
            </span>
          </div>
        </div>
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

        {(activeOrg?.role === "admin" || activeOrg?.role === "owner") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-zinc-500 uppercase tracking-widest text-[10px] font-bold">
              Organization Settings
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                {(() => {
                  const projectsUrl = `/organizations`;
                  const isActive = pathname === projectsUrl;
                  return (
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "border-2 border-black bg-white! px-5 py-2 font-semibold text-black! shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0 h-auto"
                          : "hover:bg-white/10 text-zinc-300 hover:text-white py-3 h-auto"
                      }
                    >
                      <Link href={projectsUrl}>
                        <Database
                          size={20}
                          weight={isActive ? "fill" : "duotone"}
                          className={isActive ? "text-black" : "text-zinc-400"}
                        />
                        <span>Projects</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                })()}
              </SidebarMenuItem>
              <SidebarMenuItem>
                {(() => {
                  const membersUrl = `/organizations/members`;
                  const isActive = pathname === membersUrl;
                  return (
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "border-2 border-black bg-white! px-5 py-2 font-semibold text-black! shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0 h-auto"
                          : "hover:bg-white/10 text-zinc-300 hover:text-white py-3 h-auto"
                      }
                    >
                      <Link href={membersUrl}>
                        <Users
                          size={20}
                          weight={isActive ? "fill" : "duotone"}
                          className={isActive ? "text-black" : "text-zinc-400"}
                        />
                        <span>Members</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                })()}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {activeProjectId && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-zinc-500 uppercase tracking-widest text-[10px] font-bold">
              Project Settings
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                {(() => {
                  const membersUrl = `/projects/${activeProjectId}/members`;
                  const isActive = pathname === membersUrl;
                  return (
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "border-2 border-black bg-white! px-5 py-2 font-semibold text-black! shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0 h-auto"
                          : "hover:bg-white/10 text-zinc-300 hover:text-white py-3 h-auto"
                      }
                    >
                      <Link href={membersUrl}>
                        <Users
                          size={20}
                          weight={isActive ? "fill" : "duotone"}
                          className={isActive ? "text-black" : "text-zinc-400"}
                        />
                        <span>Members</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                })()}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-4 space-y-4">
        <div className="flex flex-col gap-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-zinc-800 text-zinc-100">
                      <Users className="size-4" weight="bold" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                      <span className="truncate font-bold text-zinc-200">
                        {activeOrg?.name || "Select Org"}
                      </span>
                      <span className="truncate text-[10px] text-zinc-500 font-mono">
                        Role: {activeOrg?.role || "..."}
                      </span>
                    </div>
                    <CaretUpDown size={14} className="ml-auto text-zinc-500" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-none bg-[#141418] border-2 border-white/10 text-zinc-200"
                  align="start"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-widest px-2 py-1.5">
                    Your Organizations
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => dispatch(setActiveOrg(org.id))}
                      className={`flex items-center gap-2 px-2 py-2 cursor-pointer focus:bg-white/5 focus:text-white ${
                        org.id === activeOrgId
                          ? "bg-white/5 text-primary-foreground font-bold"
                          : ""
                      }`}
                    >
                      <span className="flex-1 truncate">{org.name}</span>
                      <span className="text-[9px] px-1 py-0.5 border border-white/10 text-zinc-500 font-mono uppercase">
                        {org.role}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-zinc-800 text-zinc-100">
                      <Database className="size-4" weight="bold" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                      <span className="truncate font-bold text-zinc-200">
                        {activeProject?.name || "Trackly"}
                      </span>
                      <span className="truncate text-[10px] text-zinc-500 font-mono">
                        Env: {activeProject?.environment || "Production"}
                      </span>
                    </div>
                    <CaretUpDown size={14} className="ml-auto text-zinc-500" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-none bg-[#141418] border-2 border-white/10 text-zinc-200"
                  align="start"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-widest px-2 py-1.5">
                    Your Projects
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => dispatch(setActiveProject(project.id))}
                      className={`flex items-center gap-2 px-2 py-2 cursor-pointer focus:bg-white/5 focus:text-white ${
                        project.id === activeProjectId
                          ? "bg-white/5 text-primary-foreground font-bold"
                          : ""
                      }`}
                    >
                      <span className="flex-1 truncate">{project.name}</span>
                      {project.environment && (
                        <span className="text-[9px] px-1 py-0.5 border border-white/10 text-zinc-500 font-mono uppercase">
                          {project.environment}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  {projects.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-zinc-500 font-mono">
                      No projects found
                    </div>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/organizations"
                      className="flex items-center w-full px-2 py-2 hover:bg-white/5 cursor-pointer"
                    >
                      <Gear size={16} className="mr-2" />
                      Manage Projects
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

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
