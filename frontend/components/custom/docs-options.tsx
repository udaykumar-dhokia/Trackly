"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, 
  FileText, 
  FileCode, 
  CaretDown, 
  ArrowSquareOut,
  Robot,
  Sparkle
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DocsOptionsProps {
  activeNav: string;
}

export default function DocsOptions({ activeNav }: DocsOptionsProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const copyToClipboard = async () => {
    // In a real app, we'd extract the actual content from the DOM or a ref
    const content = document.querySelector("main article")?.textContent || "";
    await navigator.clipboard.writeText(content);
    toast.success("Page content copied to clipboard!");
    setIsOpen(false);
  };

  const viewAsMarkdown = () => {
    const title = document.querySelector("h1")?.textContent || activeNav;
    const content = document.querySelector("#docs-content")?.textContent || "";
    const md = `# ${title}\n\n${content}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setIsOpen(false);
  };

  const openInAI = (tool: "chatgpt" | "claude") => {
    const currentUrl = window.location.href;
    const query = `Read from ${currentUrl} so I can ask questions about it.`;
    const encodedQuery = encodeURIComponent(query);
    
    const url = tool === "chatgpt" 
      ? `https://chatgpt.com/?q=${encodedQuery}`
      : `https://claude.ai/new?q=${encodedQuery}`;
      
    window.open(url, "_blank");
    setIsOpen(false);
  };

  const options = [
    {
      id: "copy",
      label: "Copy Page",
      sub: "Copy page as Markdown for LLMs",
      icon: <Copy size={20} />,
      onClick: copyToClipboard,
    },
    {
      id: "markdown",
      label: "View as Markdown",
      sub: "View this page as plain text",
      icon: <FileText size={20} />,
      onClick: viewAsMarkdown,
    },
    {
      id: "llmstxt",
      label: "llms.txt",
      sub: "Open llms.txt for this site",
      icon: <FileCode size={20} />,
      link: "/llms.txt",
      external: true,
    },
    {
      id: "chatgpt",
      label: "Open in ChatGPT",
      sub: "Ask questions about this page",
      icon: <Sparkle size={20} weight="fill" className="text-emerald-400" />,
      onClick: () => openInAI("chatgpt"),
      external: true,
    },
    {
      id: "claude",
      label: "Open in Claude",
      sub: "Ask questions about this page",
      icon: <Robot size={20} weight="fill" className="text-orange-400" />,
      onClick: () => openInAI("claude"),
      external: true,
    },
  ];

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white transition-all duration-300 rounded-xl h-9 px-4"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
          Documentation Options
        </span>
        <CaretDown size={14} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-72 z-50 origin-top-right overflow-hidden bg-[#0a0c12]/95 backdrop-blur-xl border-2 border-white/10 shadow-[20px_20px_0_0_rgba(0,0,0,0.4)]"
            >
              <div className="py-1">
                {options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (option.onClick) option.onClick();
                      if (option.link) window.open(option.link, "_blank");
                    }}
                    className="cursor-pointer group flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div className="mt-0.5 text-zinc-500 group-hover:text-white transition-colors">
                      {option.icon}
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-zinc-200 group-hover:text-white uppercase tracking-wider">
                          {option.label}
                        </span>
                        {option.external && (
                          <ArrowSquareOut size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400">
                        {option.sub}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
