import type { ReactNode } from "react";
import Header from "@/components/custom/header";
import Footer from "@/components/custom/footer";

type ResourcesShellProps = {
  children: ReactNode;
};

export default function ResourcesShell({ children }: ResourcesShellProps) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-primary/30 relative overflow-hidden">
      <style>{`
        .resources-grid::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at top center, black 22%, transparent 78%);
          pointer-events: none;
        }
        .resources-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(100px);
          pointer-events: none;
        }
        .resources-orb-a {
          width: 360px;
          height: 360px;
          background: rgba(99, 102, 241, 0.18);
          top: -100px;
          left: -60px;
        }
        .resources-orb-b {
          width: 320px;
          height: 320px;
          background: rgba(245, 158, 11, 0.12);
          top: 180px;
          right: -80px;
        }
      `}</style>

      <div className="resources-grid absolute inset-0" />
      <div className="resources-orb resources-orb-a" />
      <div className="resources-orb resources-orb-b" />

      <Header />
      <main className="relative z-10 pt-28 pb-20">{children}</main>
      <Footer />
    </div>
  );
}
