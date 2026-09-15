import { forwardRef, ReactNode, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

interface AccessibleCardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
  tabIndex?: number;
  isSelected?: boolean;
  isDisabled?: boolean;
  className?: string;
  variant?: 'default' | 'glass' | 'gradient' | 'outline';
  size?: 'sm' | 'default' | 'lg';
}

/**
 * An accessible card component with proper keyboard navigation
 * and ARIA attributes for screen readers
 */
export const AccessibleCard = forwardRef<HTMLDivElement, AccessibleCardProps>(
  (
    {
      children,
      title,
      description,
      onClick,
      onKeyDown,
      ariaLabel,
      ariaDescribedBy,
      role = onClick ? 'button' : 'article',
      tabIndex = onClick ? 0 : undefined,
      isSelected = false,
      isDisabled = false,
      className,
      variant = 'default',
      size = 'default',
    },
    ref
  ) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
      onKeyDown?.(e);
    };

    // eslint-disable-next-line react-hooks/purity
    const titleId = title ? `card-title-${Math.random().toString(36).substr(2, 9)}` : undefined;
    // eslint-disable-next-line react-hooks/purity
    const descId = description ? `card-desc-${Math.random().toString(36).substr(2, 9)}` : undefined;

    return (
      <Card
        ref={ref}
        variant={variant}
        className={cn(
          onClick && !isDisabled && [
            'cursor-pointer',
            'hover:shadow-lg hover:scale-[1.01]',
            'active:scale-[0.99]',
            'transition-all duration-200',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'focus-visible:outline-none',
          ],
          isSelected && 'ring-2 ring-primary ring-offset-2',
          isDisabled && 'opacity-50 cursor-not-allowed',
          size === 'sm' && 'text-sm',
          size === 'lg' && 'text-lg',
          className
        )}
        role={role}
        tabIndex={isDisabled ? -1 : tabIndex}
        onClick={isDisabled ? undefined : onClick}
        onKeyDown={isDisabled ? undefined : handleKeyDown}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy || descId}
        aria-labelledby={titleId}
        aria-selected={role === 'option' ? isSelected : undefined}
        aria-disabled={isDisabled}
      >
        {(title || description) && (
          <CardHeader className={cn(size === 'sm' ? 'p-3' : size === 'lg' ? 'p-6' : 'p-4')}>
            {title && (
              <CardTitle id={titleId} className={cn(size === 'sm' && 'text-base')}>
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription id={descId}>{description}</CardDescription>
            )}
          </CardHeader>
        )}
        <CardContent className={cn(size === 'sm' ? 'p-3 pt-0' : size === 'lg' ? 'p-6 pt-0' : 'p-4 pt-0')}>
          {children}
        </CardContent>
      </Card>
    );
  }
);

AccessibleCard.displayName = 'AccessibleCard';

/**
 * Card list with proper list semantics and keyboard navigation
 */
interface AccessibleCardListProps {
  children: ReactNode;
  ariaLabel: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function AccessibleCardList({
  children,
  ariaLabel,
  orientation = 'vertical',
  className,
}: AccessibleCardListProps) {
  return (
    <div
      role="list"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={cn(
        'space-y-3',
        orientation === 'horizontal' && 'flex flex-row gap-3 space-y-0 overflow-x-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card list item wrapper
 */
interface AccessibleCardListItemProps {
  children: ReactNode;
  className?: string;
}

export function AccessibleCardListItem({
  children,
  className,
}: AccessibleCardListItemProps) {
  return (
    <div role="listitem" className={className}>
      {children}
    </div>
  );
}

/**
 * Live region for announcing updates to screen readers
 */
interface LiveRegionProps {
  children: ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  className?: string;
}

export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  relevant = 'additions',
  className,
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={cn('sr-only', className)}
    >
      {children}
    </div>
  );
}
