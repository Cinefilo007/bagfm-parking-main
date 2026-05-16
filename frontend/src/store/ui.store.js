import { create } from 'zustand';

export const useUIStore = create((set) => ({
  hideSidebar: false,
  hideBottomNav: false,
  tacticalIdentity: null, // { grado, nombre, apellido, punto }
  
  setHideSidebar: (val) => set({ hideSidebar: val }),
  setHideBottomNav: (val) => set({ hideBottomNav: val }),
  setTacticalIdentity: (identity) => set({ tacticalIdentity: identity }),
  
  // Bloqueo total para relevos tácticos
  lockNavigation: (locked) => set({ 
    hideSidebar: locked, 
    hideBottomNav: locked 
  }),
}));
