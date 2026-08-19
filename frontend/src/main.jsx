import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import 'leaflet/dist/leaflet.css';
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useAuthStore } from './store/auth.store'
import { useThemeStore } from './store/theme.store'
import { registerSW } from 'virtual:pwa-register'

// Registrar Service Worker para PWA
registerSW({ immediate: true })

// Hidratar tema al iniciar la app
const currentTheme = useThemeStore.getState().isDarkMode
useThemeStore.getState().setTheme(currentTheme)

// Hidratar sesión local al iniciar la app
useAuthStore.getState().checkSession()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Toaster
      position="top-center"
      // Por encima de los modales, que van en z-index 9999.
      //
      // Con el mismo valor gana el que aparezca después en el DOM, y el Toaster está
      // declarado antes que el router: el aviso quedaba TAPADO justo cuando más falta
      // hace —dentro de un formulario, explicando por qué no se puede guardar— y el
      // usuario solo veía que el botón no hacía nada.
      containerStyle={{ zIndex: 12000 }}
      toastOptions={{
        duration: 5000,
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--bg-high)',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600'
        },
        success: {
          iconTheme: {
            primary: 'var(--primary)',
            secondary: 'var(--on-primary)',
          },
        },
        error: {
          duration: 20000,
          iconTheme: {
            primary: 'var(--danger)',
            secondary: 'var(--on-primary)',
          },
        }
      }}
    />
    <RouterProvider router={router} />
  </StrictMode>,
)
