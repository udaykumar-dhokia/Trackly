import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/custom/app-sidebar"
import { auth0 } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await auth0.getSession();
    if (!session) redirect("/auth/login");

    return (
        <SidebarProvider>
            <AppSidebar user={session.user} />
            <main className="flex flex-1 flex-col w-full h-screen overflow-hidden text-zinc-100">
                <header className="flex h-14 items-center shrink-0 border-b border-white/10 px-4 gap-4">
                    <SidebarTrigger className="text-zinc-400 hover:text-white" />
                    <div className="w-px h-4 bg-white/10" />
                    <div className="text-sm font-medium text-zinc-300">Trackly Dashboard</div>
                </header>
                <div className="flex-1 overflow-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    )
}