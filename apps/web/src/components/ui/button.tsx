import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'btn-gradient shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-[rgba(59,130,246,0.25)] bg-transparent text-[#CBD5E1] hover:bg-[rgba(59,130,246,0.08)] hover:text-[#F8FAFC] hover:border-[rgba(59,130,246,0.45)]',
        secondary:
          'bg-[rgba(59,130,246,0.1)] text-[#60A5FA] border border-[rgba(59,130,246,0.2)] hover:bg-[rgba(59,130,246,0.15)] hover:border-[rgba(59,130,246,0.35)]',
        ghost:
          'text-[#94A3B8] hover:bg-[rgba(59,130,246,0.08)] hover:text-[#F8FAFC]',
        link: 'text-[#60A5FA] underline-offset-4 hover:underline hover:text-[#3B82F6]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-xl px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
