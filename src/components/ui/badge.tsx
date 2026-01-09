import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-transparent bg-secondary/10 text-secondary",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        outline:
          "border-border text-muted-foreground bg-background",
        success:
          "border-transparent bg-success/10 text-success",
        warning:
          "border-transparent bg-warning/10 text-warning",
        error:
          "border-transparent bg-error/10 text-error",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        info:
          "border-transparent bg-primary/10 text-primary",
        gold:
          "border-transparent bg-[#B8860B]/10 text-[#B8860B]",
        // Shipping status colors
        blue:
          "border-transparent bg-blue-500/15 text-blue-600",
        cyan:
          "border-transparent bg-cyan-500/15 text-cyan-600",
        purple:
          "border-transparent bg-purple-500/15 text-purple-600",
        indigo:
          "border-transparent bg-indigo-500/15 text-indigo-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
