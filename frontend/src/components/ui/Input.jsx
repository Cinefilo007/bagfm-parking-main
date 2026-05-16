import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef(({ className, type = "text", error, label, icon, ...props }, ref) => {
  return (
    <div className="w-full mb-4">
      {label && (
        <label className="block tracking-[0.05em] text-text-sec text-xs font-medium mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "input-field",
            icon && "pl-10", // Aumentar padding si hay icono
            error && "error",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
