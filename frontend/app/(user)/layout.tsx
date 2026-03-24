import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/custom/app-sidebar"
import { FeedbackDialog } from "@/components/custom/feedback-dialog"
import { auth0 } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await auth0.getSession();
    if (!session) redirect("/auth/login");

    return (
        <SidebarProvider>
            <AppSidebar user={session.user} />
            <SidebarInset className="bg-[#09090b]">
                <header className="flex h-14 items-center shrink-0 border-b border-white/10 px-4 gap-4 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-30">
                    <SidebarTrigger className="text-zinc-400 hover:text-white" />
                    <div className="w-px h-4 bg-white/10" />
                    <div className="flex flex-1 items-center justify-between">
                        <div className="text-sm font-medium text-zinc-200">Trackly Dashboard</div>
                        <FeedbackDialog />
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-6 md:p-10">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}