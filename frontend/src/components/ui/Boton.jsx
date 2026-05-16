import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export const Boton = ({ 
  children, 
  variant = 'primario', 
  size = 'md',
  className, 
  isLoading, 
  disabled,
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-sans tracking-[0.05em] uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primario: 'btn-primario bg-primary text-on-primary hover:primary-dark shadow-sm',
    secundario: 'bg-bg-high text-primary border border-primary/20 hover:bg-primary/10',
    destructivo: 'bg-error text-white hover:bg-error-dark shadow-sm',
    ghost: 'bg-transparent text-text-sec hover:bg-bg-low dark:hover:bg-white/5 hover:text-text-main',
    outline: 'bg-transparent border border-bg-high dark:border-white/10 text-text-main hover:bg-bg-low dark:hover:bg-white/5',
  };

  const sizes = {
    sm: 'h-8 px-3 text-[10px] rounded-lg',
    md: 'min-h-[44px] px-6 py-2 rounded-xl text-xs font-bold font-sans',
    lg: 'min-h-[56px] px-8 py-3 rounded-2xl text-sm font-bold',
    icon: 'h-9 w-9 p-0 rounded-xl',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : null}
      <span className="flex items-center gap-2">{children}</span>
    </button>
  );
};
