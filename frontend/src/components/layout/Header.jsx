import React from 'react';

export const Header = ({ titulo, subtitle, actionElement }) => {
  return (
    <header className="bg-bg-app border-b border-bg-high/10 py-8 px-4 md:px-8 mb-6">
      <div className="container mx-auto flex items-center justify-between">
        <div>
          {subtitle && (
            <p className="text-primary font-mono text-[10px] font-bold uppercase tracking-[0.2em] mb-1 opacity-80">
              {subtitle}
            </p>
          )}
          <h1 className="font-display font-black text-2xl lg:text-4xl tracking-tight text-text-main leading-none uppercase">
            {titulo}
          </h1>
        </div>
        {actionElement && (
          <div className="flex-shrink-0 ml-4">
            {actionElement}
          </div>
        )}
      </div>
    </header>
  );
};
