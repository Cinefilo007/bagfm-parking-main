import React from 'react';
import { cn } from '../../lib/utils';

export const ChipFiltro = ({ 
  children, 
  activo = false, 
  tipo = 'default', // 'activos', 'suspendidos', 'infracciones'
  onClick,
  className
}) => {
  const activoStyles = "bg-primary-dark text-on-primary font-medium";
  
  const inactivoTheme = {
    default: "border-text-muted/30 text-text-sec",
    activos: "border-primary/40 text-primary",
    suspendidos: "border-danger/40 text-danger",
    infracciones: "border-warning/40 text-warning"
  };

  const inactivoStyles = `bg-transparent border ${inactivoTheme[tipo] || inactivoTheme.default}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-200 outline-none",
        activo ? activoStyles : inactivoStyles,
        className
      )}
    >
      {children}
    </button>
  );
};
