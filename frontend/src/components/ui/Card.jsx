import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, elevation = 2, hoverable = false, ...props }) => {
  // Manejador de elevación según Design System Aegis
  const elevaciones = {
    1: 'bg-bg-low',      // Capa 1: layout blocks
    2: 'bg-bg-card',     // Capa 2: Contenedores iterativos normales
    3: 'bg-bg-high',     // Capa 3: Cards interactuadas (hover en custom CSS)
    4: 'bg-bg-modal',    // Capa 4: Highest elevation
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 transition-all duration-200 border border-text-main/10 dark:border-bg-high/20 shadow-tactica shadow-text-main/5 dark:shadow-tactica",
        elevaciones[elevation] || elevaciones[2],
        hoverable && "cursor-pointer hover:bg-bg-high/40",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => (
  <div className={cn("mb-4", className)} {...props}>{children}</div>
);

export const CardTitle = ({ children, className, ...props }) => (
  <h3 className={cn("text-lg font-bold text-text-main leading-none tracking-tight", className)} {...props}>{children}</h3>
);

export const CardContent = ({ children, className, ...props }) => (
  <div className={cn("", className)} {...props}>{children}</div>
);
