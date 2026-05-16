import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set) => ({
      isDarkMode: true, // Default a oscuro como está el sistema actualmente
      toggleTheme: () => set((state) => {
        const nextMode = !state.isDarkMode;
        // Aplicar clase al documento para cambios inmediatos fuera de React si es necesario
        if (nextMode) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
        return { isDarkMode: nextMode };
      }),
      setTheme: (isDark) => {
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
        set({ isDarkMode: isDark });
      },
    }),
    {
      name: 'bagfm-theme-storage',
    }
  )
);
