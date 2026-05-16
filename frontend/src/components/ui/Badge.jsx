import React from 'react';
import { cn } from '../../lib/utils';

const variantConfig = {
  activa: 'bg-primary/15 text-primary border border-primary/30',
  suspendida: 'bg-danger/15 text-danger border border-danger/30',
  pendiente: 'bg-warning/15 text-warning border border-warning/30',
  'sin-membresia': 'bg-text-muted/15 text-text-muted border border-text-muted/20',
  comando: 'bg-primary/20 text-primary border border-primary/40',
};

export const Badge = ({ children, variant = 'activa', className }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-sans font-semibold text-[0.625rem] tracking-[0.08em] uppercase",
        variantConfig[variant] || variantConfig.activa,
        className
      )}
    >
      {children}
    </span>
  );
};
