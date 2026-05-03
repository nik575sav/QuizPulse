import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "play";
  size?: "default" | "sm" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-bold ring-offset-background transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-indigo-600 text-white shadow-[0_4px_0_#4F46E5] hover:-translate-y-1": variant === "default",
            "bg-rose-500 text-white shadow-[0_4px_0_#E11D48] hover:-translate-y-1": variant === "destructive",
            "border-2 border-slate-200 bg-white shadow-sm hover:border-indigo-300 hover:text-indigo-600": variant === "outline",
            "hover:bg-slate-100 hover:text-slate-900": variant === "ghost",
            "bg-[#FFD32D] text-slate-900 shadow-[0_4px_0_#D4AF1B] hover:-translate-y-1 font-black uppercase tracking-wider": variant === "play",
            "h-12 px-6 py-3 text-base": size === "default",
            "h-10 rounded-xl px-4": size === "sm",
            "h-16 rounded-[1.5rem] px-8 text-xl": size === "lg",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
