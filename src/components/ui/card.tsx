import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl border text-card-foreground transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "bg-card shadow-soft",
        glass: "backdrop-blur-xl bg-card/70 border-border/50 shadow-soft",
        gradient: "bg-gradient-to-br from-card to-secondary/30 shadow-medium",
        gradientSuccess: "bg-gradient-success text-success-foreground border-success/20 shadow-glow-success",
        gradientPrimary: "bg-gradient-primary text-primary-foreground border-primary/20 shadow-glow",
        gradientWarning: "bg-gradient-warning text-warning-foreground border-warning/20 shadow-glow-warning",
        gradientDestructive: "bg-gradient-destructive text-destructive-foreground border-destructive/20 shadow-glow-destructive",
        elevated: "bg-card shadow-strong",
        outline: "bg-transparent border-2",
        ghost: "bg-transparent border-transparent shadow-none",
        interactive: "bg-card shadow-soft hover:shadow-medium active:shadow-sm",
      },
      hover: {
        none: "",
        lift: "hover:-translate-y-1 hover:shadow-medium active:translate-y-0 active:shadow-sm cursor-pointer",
        glow: "hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] active:shadow-[0_0_10px_hsl(var(--primary)/0.2)] cursor-pointer",
        scale: "hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        border: "hover:border-primary/50 active:border-primary/70 cursor-pointer",
        pulse: "hover:animate-pulse cursor-pointer",
        shimmer: "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full hover:before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent cursor-pointer",
      },
      pressed: {
        none: "",
        sink: "active:scale-[0.98] active:shadow-inner",
        flash: "active:bg-primary/5",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: "none",
      pressed: "none",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  animate?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, hover }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
