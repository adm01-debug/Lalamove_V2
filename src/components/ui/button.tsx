import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-150 active:scale-[0.97] hover:[&_svg]:scale-110",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md shadow-destructive/25 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30 hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border-2 border-border bg-transparent hover:bg-secondary hover:text-secondary-foreground hover:border-primary/50 hover:-translate-y-0.5 active:translate-y-0 active:bg-secondary/80",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:-translate-y-0.5 active:translate-y-0",
        ghost: "hover:bg-secondary hover:text-secondary-foreground active:bg-secondary/80",
        link: "text-primary underline-offset-4 hover:underline active:opacity-70",
        success:
          "bg-success text-success-foreground shadow-md shadow-success/25 hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 hover:-translate-y-0.5 active:translate-y-0",
        warning:
          "bg-warning text-warning-foreground shadow-md shadow-warning/25 hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/30 hover:-translate-y-0.5 active:translate-y-0",
        gradient:
          "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95",
        "gradient-success":
          "bg-gradient-to-r from-success to-emerald text-success-foreground shadow-lg shadow-success/30 hover:shadow-xl hover:shadow-success/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0",
        glow: "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)] active:shadow-[0_0_15px_hsl(var(--primary)/0.3)]",
        "glow-accent":
          "bg-accent text-accent-foreground shadow-[0_0_20px_hsl(var(--accent)/0.4)] hover:shadow-[0_0_30px_hsl(var(--accent)/0.6)] active:shadow-[0_0_15px_hsl(var(--accent)/0.3)]",
        glass:
          "backdrop-blur-xl bg-card/50 border border-border/50 text-foreground hover:bg-card/70 hover:border-border active:bg-card/60",
        // New micro-interaction variants
        bounce:
          "bg-primary text-primary-foreground shadow-md hover:animate-bounce active:scale-95",
        ripple:
          "bg-primary text-primary-foreground shadow-md relative overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-white/20 after:scale-0 after:rounded-full after:opacity-0 active:after:scale-150 active:after:opacity-100 after:transition-all after:duration-300",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-10 w-10 max-sm:h-11 max-sm:w-11",
        "icon-sm": "h-8 w-8 rounded-lg max-sm:h-11 max-sm:w-11",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
