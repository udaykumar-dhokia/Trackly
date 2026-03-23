"use client";
import { ArrowUpRightIcon, CoinVerticalIcon } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import Link from "next/link";

const menuItems = [
  {
    label: "Docs",
    href: "/docs",
  },
  {
    label: "Features",
    href: "#",
  },
  {
    label: "Pricing",
    href: "#",
  },
  {
    label: "About",
    href: "#",
  },
  {
    label: "Contact",
    href: "#",
  },
];

const Header = () => {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link className="text-white flex items-center" href="/">
          <span className="sr-only">Home</span>
          <h1 className="font-bold text-2xl">Trackly</h1>
        </Link>

        <div className="flex flex-1 items-center justify-end md:justify-between">
          <nav aria-label="Global" className="hidden md:block">
            <ul className="flex items-center gap-6 text-sm">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <a
                    className="text-gray-500 transition hover:text-gray-500/75"
                    href={item.href}
                  >
                    {" "}
                    {item.label}{" "}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-4">
            <div className="sm:flex sm:gap-4">
              <a href="/auth/login">
                <Button className="cursor-pointer border-2 border-black bg-white px-5 py-3 font-semibold text-black shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0">
                  Login
                </Button>
              </a>

              <Link href="/auth/login?screen_hint=signup">
                <Button className="cursor-pointer border-2 border-black bg-white px-5 py-3 font-semibold text-black shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0">
                  Get Started Free <ArrowUpRightIcon />
                </Button>
              </Link>
            </div>

            <button className="block rounded-sm bg-gray-100 p-2.5 text-gray-600 transition hover:text-gray-600/75 md:hidden">
              <span className="sr-only">Toggle menu</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
