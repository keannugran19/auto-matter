import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "text-primary",
        secondary: "text-muted-foreground",
        destructive: "text-destructive",
        outline: "text-muted-foreground",
        newBelievers: "text-[hsl(var(--nb))]",
        nb: "text-[hsl(var(--nb))]",
        mentoring:
          "text-[hsl(28_90%_38%)] dark:text-[hsl(var(--mt))]",
        mt:
          "text-[hsl(28_90%_38%)] dark:text-[hsl(var(--mt))]",
        leadership: "text-[hsl(var(--ld))]",
        ld: "text-[hsl(var(--ld))]",
        success:
          "text-[hsl(142_60%_30%)] dark:text-[hsl(142_70%_60%)]",
        ok:
          "text-[hsl(142_60%_30%)] dark:text-[hsl(142_70%_60%)]",
        warning:
          "text-[hsl(28_90%_38%)] dark:text-[hsl(38_95%_65%)]",
        warn:
          "text-[hsl(28_90%_38%)] dark:text-[hsl(38_95%_65%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
