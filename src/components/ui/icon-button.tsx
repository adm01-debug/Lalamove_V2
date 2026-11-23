import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
  /** Visible label used for aria-label and tooltip. Required for accessibility. */
  label: string;
  icon: React.ReactNode;
  /** Show tooltip. Defaults to true. */
  tooltip?: boolean;
  /** Tooltip side. Defaults to 'top'. */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Accessible icon-only button with required label for aria-label and tooltip.
 * Use instead of <Button size="icon"> whenever there is no visible text label.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, tooltip = true, side = 'top', className, ...props }, ref) => {
    const btn = (
      <Button
        ref={ref}
        size="icon"
        aria-label={label}
        className={cn(className)}
        {...props}
      >
        {icon}
      </Button>
    );

    if (!tooltip) return btn;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side={side}>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  },
);

IconButton.displayName = 'IconButton';