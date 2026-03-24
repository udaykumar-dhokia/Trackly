"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, Info, WarningCircle, XCircle, CircleNotch } from "@phosphor-icons/react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CheckCircle weight="fill" className="size-5 text-emerald-400" />,
        info: <Info weight="fill" className="size-5 text-indigo-400" />,
        warning: <WarningCircle weight="fill" className="size-5 text-amber-400" />,
        error: <XCircle weight="fill" className="size-5 text-red-400" />,
        loading: <CircleNotch weight="bold" className="size-5 text-zinc-400 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0f0f12] group-[.toaster]:text-zinc-100 group-[.toaster]:border-2 group-[.toaster]:border-white/10 group-[.toaster]:shadow-[8px_8px_0_0_#000] group-[.toaster]:rounded-none group-[.toaster]:p-4 group-[.toaster]:gap-3",
          description: "group-[.toast]:text-zinc-500 group-[.toast]:font-mono group-[.toast]:text-[10px]",
          actionButton:
            "group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-900 group-[.toast]:font-bold group-[.toast]:rounded-none",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-400 group-[.toast]:font-bold group-[.toast]:rounded-none",
          success: "group-[.toast]:border-emerald-500/50 group-[.toast]:bg-[#0c1410]",
          error: "group-[.toast]:border-red-500/50 group-[.toast]:bg-[#1a1010]",
          warning: "group-[.toast]:border-amber-500/50 group-[.toast]:bg-[#1a1610]",
          info: "group-[.toast]:border-indigo-500/50 group-[.toast]:bg-[#10121a]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
