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
import { usePathname, useRouter } from "next/navigation";
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
  ChartLineUp,
  Wallet,
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
    title: "Budgets",
    url: "/budgets",
    icon: Wallet,
  },
  {
    title: "API Keys",
    url: "/api-keys",
    icon: Key,
  },
  // {
  //   title: "Settings",
  //   url: "/settings",
  //   icon: Gear,
  // },
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
  const router = useRouter();

  const dispatch = useAppDispatch();
  const {
    items: projects,
    activeProjectId,
    organizations,
    activeOrgId,
    status: projectsStatus,
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

  const handleProjectSwitch = (newProjectId: string) => {
    dispatch(setActiveProject(newProjectId));

    if (pathname.includes("/projects/")) {
      const segments = pathname.split("/");
      const projectIndex = segments.indexOf("projects");
      if (projectIndex !== -1 && segments[projectIndex + 1]) {
        segments[projectIndex + 1] = newProjectId;
        router.push(segments.join("/"));
      }
    }
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-white/10"
      {...props}
      variant="floating"
    >
      <SidebarHeader className="border-b border-white/5 pb-6 pt-6 px-4 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <img src="/logo/logo-48.png" className="w-10 h-10" />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-white leading-none">
              Trackly
            </span>
            <span className="text-[9px] text-zinc-500 font-mono tracking-[0.2em] mt-1 uppercase">
              AI Observability
            </span>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer rounded-none h-14"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-indigo-500 text-white shadow-[2px_2px_0_0_#000]">
                    <Users className="size-4" weight="bold" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                      Workspace
                    </span>
                    <span className="truncate text-white group-data-[collapsible=icon]:hidden">
                      {activeOrg?.name || "Select Org"}
                    </span>
                  </div>
                  <CaretUpDown
                    size={14}
                    className="ml-auto text-zinc-500 group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-none bg-[#141418] border-2 border-white/10 text-zinc-200 p-2 shadow-[8px_8px_0_0_rgba(0,0,0,0.5)]"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={12}
              >
                <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] px-2 py-1.5 font-black">
                  Switch Workspace
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10 mb-2" />
                <div className="space-y-1">
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => {
                        dispatch(setActiveOrg(org.id));
                        if (pathname.includes("/projects/")) {
                          router.push("/dashboard");
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-3 cursor-pointer rounded-none border border-transparent transition-all focus:bg-indigo-500/10 focus:border-indigo-500/30 focus:text-white ${
                        org.id === activeOrgId
                          ? "bg-indigo-500/10 border-indigo-500/30 text-white font-bold"
                          : ""
                      }`}
                    >
                      <div
                        className={`size-2 rounded-full ${org.id === activeOrgId ? "bg-indigo-500 animate-pulse" : "bg-zinc-700"}`}
                      />
                      <span className="flex-1 truncate">{org.name}</span>
                      <span className="text-[8px] px-1.5 py-0.5 border border-white/10 text-zinc-500 font-mono uppercase">
                        {org.role}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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
                    <Link
                      href={item.url}
                      target={item.title === "Docs" ? "_blank" : ""}
                    >
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
              <SidebarMenuItem>
                {(() => {
                  const usageUrl = `/organizations/usage`;
                  const isActive = pathname === usageUrl;
                  return (
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "border-2 border-foreground bg-foreground text-background px-5 py-3 font-bold shadow-primary shadow-[4px_4px_0_0] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus:outline-0 h-auto rounded-none transition-all tracking-wider"
                          : "hover:bg-secondary text-muted-foreground hover:text-foreground font-semibold py-3 h-auto transition-all rounded-none tracking-wider"
                      }
                    >
                      <Link href={usageUrl}>
                        <ChartLineUp
                          size={20}
                          weight={isActive ? "bold" : "duotone"}
                        />
                        <span>Usage & Billing</span>
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
              Project Context:{" "}
              <span className="text-indigo-400 ml-1">
                {activeProject?.name}
              </span>
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
                        <span>Project Members</span>
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
                    disabled={projectsStatus === "loading"}
                    className="bg-[#0c0c0e] border border-white/10 hover:bg-white/10 transition-colors cursor-pointer rounded-none disabled:opacity-50"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-zinc-800 text-zinc-400">
                      {projectsStatus === "loading" ? (
                        <div className="size-4 border-2 border-zinc-500 border-t-transparent animate-spin" />
                      ) : (
                        <Database className="size-4" weight="bold" />
                      )}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                      <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                        {projectsStatus === "loading"
                          ? "Fetching..."
                          : "Active Project"}
                      </span>
                      <span className="truncate font-bold text-zinc-200">
                        {projectsStatus === "loading"
                          ? "Loading Projects..."
                          : activeProject?.name || "No Project Selected"}
                      </span>
                    </div>
                    <CaretUpDown size={14} className="ml-auto text-zinc-600" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-none bg-[#141418] border-2 border-white/10 text-zinc-200 p-2"
                  align="start"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-widest px-2 py-1.5 font-bold">
                    Switch Project
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
                    {projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => handleProjectSwitch(project.id)}
                        className={`flex items-center gap-2 px-2 py-2 cursor-pointer focus:bg-white/5 focus:text-white border border-transparent ${
                          project.id === activeProjectId
                            ? "bg-white/5 border-white/10 text-white font-bold"
                            : ""
                        }`}
                      >
                        <span className="flex-1 truncate">{project.name}</span>
                        {project.environment && (
                          <span className="text-[8px] px-1 py-0.5 border border-white/10 text-zinc-500 font-mono uppercase">
                            {project.environment}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    {projects.length === 0 && (
                      <div className="px-2 py-8 text-center text-[10px] text-zinc-600 font-mono italic">
                        No projects found in this workspace.
                      </div>
                    )}
                  </div>
                  <DropdownMenuSeparator className="bg-white/10 mt-2" />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/organizations"
                      className="flex items-center w-full px-2 py-2 hover:bg-white/5 cursor-pointer text-xs font-bold text-indigo-400"
                    >
                      <Gear size={16} className="mr-2" />
                      Project Settings
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
