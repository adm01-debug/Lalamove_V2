import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25",
        outline: "border-border text-foreground hover:bg-secondary",
        success:
          "border-success/40 bg-success/15 text-success hover:bg-success/25",
        warning:
          "border-warning/40 bg-warning/15 text-warning hover:bg-warning/25",
        info: "border-info/40 bg-info/15 text-info hover:bg-info/25",
        muted:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        // Gradient variants
        gradient:
          "border-transparent bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm",
        "gradient-success":
          "border-transparent bg-gradient-to-r from-success to-emerald text-success-foreground shadow-sm",
        "gradient-warning":
          "border-transparent bg-gradient-to-r from-warning to-amber text-warning-foreground shadow-sm",
        "gradient-destructive":
          "border-transparent bg-gradient-to-r from-destructive to-rose text-destructive-foreground shadow-sm",
        // Glow variants
        glow: "border-primary/50 bg-primary/20 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]",
        "glow-success":
          "border-success/50 bg-success/20 text-success shadow-[0_0_10px_hsl(var(--success)/0.3)]",
        "glow-destructive":
          "border-destructive/50 bg-destructive/20 text-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.3)]",
        // Pill variants with dot
        live: "border-success/50 bg-success/15 text-success animate-pulse",
        pending:
          "border-warning/50 bg-warning/15 text-warning",
        inactive: "border-muted bg-muted/50 text-muted-foreground",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, dot, pulse, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-current",
              pulse && "animate-pulse"
            )}
          />
        )}
        {children}
      </div>
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
