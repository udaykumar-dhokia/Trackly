"use client";
import { ArrowUpRightIcon, List, X } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    label: "Documentation",
    href: "/docs",
  },
  {
    label: "Resources",
    href: "/resources",
    highlighted: true,
  },
  {
    label: "Changelog",
    href: "/changelogs",
  },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            className="text-white flex gap-1.5 items-center shrink-0"
            href="/"
          >
            <span className="sr-only">Home</span>
            <Image
              src="/logo/logo-48.png"
              alt="Trackly logo"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <h1 className="font-bold text-xl sm:text-2xl tracking-tight">
              Trackly
            </h1>
          </Link>

          <nav aria-label="Global" className="hidden md:block">
            <ul className="flex items-center gap-4 text-sm">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <Link
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition hover:text-white
                      pathname?.startsWith(item.href)
                        ? "text-white"
                        : "text-zinc-400"
                    }`}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <a href="/auth/login" className="hidden sm:block">
              <Button className="rounded-xl cursor-pointer bg-transparent px-4 py-2 sm:px-5 sm:py-3 text-[13px] sm:text-sm font-bold text-white hover:bg-indigo-300 hover:text-black focus:ring-2 focus:ring-indigo-300 focus:outline-0 transition-all">
                Login
              </Button>
            </a>

            <Link href="/auth/login?screen_hint=signup">
              <Button className="rounded-xl inset-shadow-2xs inset-shadow-white/30 cursor-pointer border-black bg-white/20 px-4 sm:px-5 text-[13px] sm:text-sm font-bold text-white hover:bg-indigo-300 hover:text-black focus:ring-2 focus:ring-indigo-300 focus:outline-0 transition-all flex items-center gap-1.5">
                <span className="hidden xs:inline">Get Started Free</span>
                <span className="xs:hidden">Get Started</span>
                <ArrowUpRightIcon weight="bold" className="size-3.5" />
              </Button>
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex md:hidden p-2 text-zinc-400 hover:text-white transition-colors z-50"
          >
            <span className="sr-only">Toggle menu</span>
            {isMenuOpen ? (
              <X size={24} weight="bold" />
            ) : (
              <List size={24} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#09090b]/95 backdrop-blur-md md:hidden flex flex-col pt-24 px-6">
          <nav className="flex flex-col gap-6 text-center">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`mx-auto inline-flex items-center gap-3 rounded-full px-4 py-2 text-2xl font-bold tracking-tight transition-colors backdrop-blur-md ${
                  item.highlighted
                    ? "border border-indigo-400/30 bg-indigo-500/10 shadow-[0_0_24px_rgba(99,102,241,0.16)]"
                    : ""
                } ${
                  pathname?.startsWith(item.href)
                    ? "text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {item.label}
                {item.highlighted ? (
                  <span className="rounded-full border border-indigo-300/30 bg-indigo-300/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-100">
                    New
                  </span>
                ) : null}
              </Link>
            ))}
            <div className="h-px bg-white/10 my-4" />
            <a
              href="/auth/login"
              onClick={() => setIsMenuOpen(false)}
              className="text-xl font-bold text-zinc-400 hover:text-white transition-colors backdrop-blur-md"
            >
              Login
            </a>
          </nav>

          <div className="mt-auto mb-12 text-center">
            <p className="text-sm text-zinc-500 font-mono">
              Trackly &copy; 2026
            </p>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
