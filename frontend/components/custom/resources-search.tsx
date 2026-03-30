"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SearchArticle = {
  title: string;
  description: string;
  chapterTitle: string;
  tags: string[];
  path: string;
};

type ResourcesSearchProps = {
  articles: SearchArticle[];
};

export default function ResourcesSearch({ articles }: ResourcesSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) {
      return articles;
    }

    return articles.filter((article) => {
      const haystack = [
        article.title,
        article.description,
        article.chapterTitle,
        article.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [articles, normalizedQuery]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-1 text-left backdrop-blur-md transition hover:border-white/40 hover:bg-white/8 sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition group-hover:text-white">
              <MagnifyingGlass size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-300">
                Search AI agents, RAG, LangChain...
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-zinc-400 sm:inline-flex">
            <span>Ctrl</span>
            <span>K</span>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-1.25rem)] max-w-3xl rounded-xl border border-white/10 bg-[#09090b] p-0 text-white ring-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b border-white/8 px-4 py-4 sm:px-6">
          <DialogTitle className="text-base font-semibold text-white">
            Search resources
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Find articles across AI agents, RAG, LangChain, and LLM costs.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="text-zinc-500"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search AI agents, RAG, LangChain..."
              className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-white shadow-none ring-0 placeholder:text-zinc-500 focus-visible:ring-0"
            />
            <div className="hidden rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-zinc-500 sm:inline-flex">
              ESC
            </div>
          </div>

          <div className="mt-4 max-h-[min(60vh,34rem)] space-y-3 overflow-y-auto pr-1">
            {results.length > 0 ? (
              results.map((article) => (
                <Link
                  key={article.path}
                  href={article.path}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl border border-white/8 bg-black/20 px-4 py-4 transition hover:border-white/40 hover:bg-white/8"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                    {article.chapterTitle}
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {article.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">
                    {article.description}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">
                No matches yet. Try a broader keyword.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
