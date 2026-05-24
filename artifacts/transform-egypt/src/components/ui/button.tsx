import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[2px] text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-gold hover:text-black hover:-translate-y-0.5 shadow-lg hover:shadow-gold/20",
        primary:
          "bg-black text-white hover:bg-gold hover:text-black border border-transparent hover:border-gold hover:-translate-y-0.5 shadow-xl",
        secondary:
          "bg-transparent text-gold border-2 border-gold hover:bg-gold hover:text-black hover:-translate-y-0.5 shadow-lg",
        shop:
          "bg-gradient-gold-pill text-black font-semibold hover:opacity-90 hover:-translate-y-0.5 border border-[#B89968]/40 shadow-[0_4px_18px_rgba(184,153,104,0.35)] hover:shadow-[0_8px_24px_rgba(184,153,104,0.5)]",
        pill:
          "bg-gradient-gold-pill text-black font-semibold tracking-[0.15em] uppercase hover:opacity-90 hover:-translate-y-0.5 border border-[#B89968]/50 shadow-[0_6px_22px_rgba(184,153,104,0.4)] hover:shadow-[0_10px_28px_rgba(184,153,104,0.55)] rounded-full",
        ghost: "hover:bg-white/10 hover:text-white text-gray-300",
        outline:
          "bg-transparent border border-white/20 text-white hover:bg-white/10 hover:text-white",
        link: "text-gold underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-8 py-3",
        sm: "h-10 px-6 py-2 text-xs",
        lg: "h-14 px-10 py-4 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
