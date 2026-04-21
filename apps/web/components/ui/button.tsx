'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** designer_spec §6 - Button 변형/사이즈/상태 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-button font-semibold transition-colors duration-snap ease-snap focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        accent:
          'bg-accent text-accent-foreground hover:bg-accent-hover active:scale-[0.98]',
        ghost:
          'bg-transparent text-foreground hover:bg-secondary',
        destructive:
          'bg-status-error text-white hover:opacity-90',
        link:
          'bg-transparent text-accent hover:text-accent-hover underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-body-sm',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-5 text-lead',
        xl: 'h-14 px-6 text-lead',
        icon: 'h-11 w-11 p-0', // 44px 터치 타겟
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'lg',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Render children as-is with button classes (e.g. to wrap Link). */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, loading, asChild, children, disabled, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, block }), className);

    if (asChild && React.isValidElement(children)) {
      const childEl = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(childEl, {
        className: cn(classes, childEl.props.className),
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
