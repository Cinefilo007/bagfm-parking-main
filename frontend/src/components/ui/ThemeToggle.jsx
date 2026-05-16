import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/theme.store';

export const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-6 right-6 z-[100] w-10 h-10 flex items-center justify-center rounded-full bg-bg-modal/80 backdrop-blur-md border border-white/10 shadow-tactica hover:scale-105 transition-all text-text-main active:scale-95 group lg:hidden"
      aria-label="Toggle Theme"
    >
      {isDarkMode ? (
        <Sun size={20} className="group-hover:text-primary transition-colors" />
      ) : (
        <Moon size={20} className="group-hover:text-primary transition-colors" />
      )}
    </button>
  );
};
