import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RutaProtegida } from './RutaProtegida';
import { MainLayout } from '../components/layout/MainLayout';
import Login from '../pages/Login';
import DashboardComando from '../pages/comandante/Dashboard';
import Entidades from '../pages/comandante/Entidades';
import EntidadDetalle from '../pages/comandante/EntidadDetalle';
import GestionZonas from '../pages/comandante/GestionZonas';
import InfraccionesComando from '../pages/comandante/Infracciones';
import DashboardEntidad from '../pages/entidad/Dashboard';
import SociosEntidad from '../pages/entidad/Socios';
import EstacionamientosEntidad from '../pages/entidad/Estacionamientos';
import DashboardAlcabala from '../pages/alcabala/Dashboard';
import ScannerAlcabala from '../pages/alcabala/Scanner';
import PuertaAlcabala from '../pages/alcabala/Puerta';
import MonitorAlcabala from '../pages/alcabala/Monitor';
import Alcabalas from '../pages/comandante/Alcabalas';
import CamarasAnpr from '../pages/comandante/CamarasAnpr';
import EventosMando from '../pages/comandante/EventosMando';
import PasesMasivosEntidad from '../pages/entidad/PasesMasivos';
import EditorCarnets from '../pages/entidad/EditorCarnets';
import Ajustes from '../pages/Ajustes';
import Personal from '../pages/Personal';
import PortalSocio from '../pages/socio/Portal';
import InfraccionesSocio from '../pages/socio/Infracciones';
import PortalEvento from '../pages/PortalEvento';
import PortalPase from '../pages/PortalPase';
import HistorialAccesos from '../pages/socio/HistorialAccesos';
import DashboardParquero from '../pages/parquero/Dashboard';
import VistaRecibir from '../pages/parquero/VistaRecibir';
import VistaDespachar from '../pages/parquero/VistaDespachar';
import VistaNotificaciones from '../pages/parquero/VistaNotificaciones';
import VistaVehiculosPerdidos from '../pages/parquero/VistaVehiculosPerdidos';
import DashboardSupervisor from '../pages/supervisor/Dashboard';
import DashboardSupervisorBase from '../pages/supervisor-base/Dashboard';
import CensoVehicularSupervisor from '../pages/supervisor-base/CensoVehicular';
import CensoPersonasSupervisor from '../pages/supervisor-base/CensoPersonas';
import PaseTemporalSupervisor from '../pages/supervisor-base/PaseTemporal';

// Módulo Combustible Aegis Fuel
import DashboardBombero from '../pages/combustible/DashboardBombero';
import ReporteCombustible from '../pages/combustible/ReporteCombustible';
import ParqueAutomotor from '../pages/combustible/ParqueAutomotor';
import ColaAprobacionesCombustible from '../pages/combustible/ColaAprobacionesCombustible';
import GestionTanques from '../pages/combustible/GestionTanques';
import DashboardSupervisorBomberos from '../pages/combustible/DashboardSupervisorBomberos';

import { useAuthStore } from '../store/auth.store';

const TemporaryPlaceholder = ({ name }) => (
  <div className="flex h-screen items-center justify-center bg-bg-app text-white">
     <h1>App: {name}</h1>
  </div>
);

const HomeRedirect = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol === 'COMANDANTE' || user.rol === 'ADMIN_BASE') return <Navigate to="/comando/dashboard" replace />;
  if (user.rol === 'SUPERVISOR') return <Navigate to="/supervisor-base/dashboard" replace />;
  if (user.rol === 'BOMBERO') return <Navigate to="/combustible/dashboard" replace />;
  if (user.rol === 'SUPERVISOR_BOMBEROS') return <Navigate to="/combustible-supervisor/dashboard" replace />;
  if (user.rol === 'ADMIN_ENTIDAD') return <Navigate to="/entidad/dashboard" replace />;
  if (user.rol === 'ALCABALA') return <Navigate to="/alcabala/dashboard" replace />;
  if (user.rol === 'SUPERVISOR_PARQUEROS') return <Navigate to="/supervisor/dashboard" replace />;
  if (user.rol === 'PARQUERO') return <Navigate to="/parquero/dashboard" replace />;
  if (user.rol === 'SOCIO') return <Navigate to="/socio/portal" replace />;
  return <Navigate to="/ajustes" replace />;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <RutaProtegida />,
    children: [
      {
        path: '',
        element: <HomeRedirect />
      },
      // ====== MONITOR DE ALCABALA (TV, MODO KIOSCO) ======
      // Fuera de MainLayout y sin RutaProtegida a propósito: un televisor no tiene
      // sesión de persona, se autentica con su propio token de pantalla, y no debe
      // arrastrar barras de navegación ni el conmutador de tema. La propia vista
      // decide qué credencial usa; sin ninguna, el interceptor manda al login.
      // Ruta corta porque hay que teclearla en el navegador de un televisor.
      {
        path: 'monitor',
        element: <MonitorAlcabala />
      },
      // ====== RUTAS CON NAVEGACIÓN (LAYOUT PRINCIPAL) ======
      {
        element: <MainLayout />,
        children: [
          // COMANDO
          {
            path: 'comando',
            element: <RutaProtegida rolesPermitidos={['COMANDANTE', 'ADMIN_BASE', 'SUPERVISOR']} />,
            children: [
              { path: 'dashboard', element: <DashboardComando /> },
              { path: 'entidades', element: <Entidades /> },
              { path: 'entidades/:id', element: <EntidadDetalle /> },
              { path: 'alcabalas', element: <Alcabalas /> },
              { path: 'eventos', element: <EventosMando /> },
              { path: 'personal', element: <Personal /> },
              { path: 'zonas', element: <GestionZonas /> },
              { path: 'infracciones', element: <InfraccionesComando /> },
              { path: 'carnets', element: <EditorCarnets /> },
              // Los endpoints de cámaras solo aceptan COMANDANTE y ADMIN_BASE, así
              // que esta vista lleva su propia guarda: el bloque /comando también
              // deja entrar a SUPERVISOR, que aquí solo se encontraría con 403.
              {
                path: 'camaras',
                element: <RutaProtegida rolesPermitidos={['COMANDANTE', 'ADMIN_BASE']} />,
                children: [{ path: '', element: <CamarasAnpr /> }]
              }
            ],
          },
          // ENTIDAD
          {
            path: 'entidad',
            element: <RutaProtegida rolesPermitidos={['ADMIN_ENTIDAD']} />,
            children: [
              { path: 'dashboard', element: <DashboardEntidad /> },
              { path: 'socios', element: <SociosEntidad /> },
              { path: 'personal', element: <Personal /> },
              { path: 'pases-masivos', element: <PasesMasivosEntidad /> },
              { path: 'estacionamientos', element: <EstacionamientosEntidad /> },
              { path: 'carnets', element: <EditorCarnets /> }
            ]
          },
          // ALCABALA
          {
            path: 'alcabala',
            element: <RutaProtegida rolesPermitidos={['ALCABALA', 'ADMIN_BASE', 'COMANDANTE']} />,
            children: [
              { path: 'dashboard', element: <DashboardAlcabala /> },
              { path: 'scanner', element: <ScannerAlcabala /> },
              // El escáner QR sigue vivo para socios y pases; la puerta es el flujo
              // nuevo para el visitante que llega sin nada.
              { path: 'puerta', element: <PuertaAlcabala /> }
            ]
          },
          // PARQUERO
          {
            path: 'parquero',
            element: <RutaProtegida rolesPermitidos={['PARQUERO', 'ADMIN_BASE', 'COMANDANTE', 'SUPERVISOR_PARQUEROS']} />,
            children: [
              { path: '', element: <DashboardParquero /> },
              { path: 'dashboard', element: <DashboardParquero /> },
              { path: 'recibir', element: <VistaRecibir /> },
              { path: 'despachar', element: <VistaDespachar /> },
              { path: 'notificaciones', element: <VistaNotificaciones /> },
              { path: 'perdidos', element: <VistaVehiculosPerdidos /> },
            ]
          },
          // SUPERVISOR DE PARQUEROS
          {
            path: 'supervisor',
            element: <RutaProtegida rolesPermitidos={['SUPERVISOR_PARQUEROS', 'ADMIN_BASE', 'COMANDANTE']} />,
            children: [
              { path: 'dashboard', element: <DashboardSupervisor /> }
            ]
          },
          // SUPERVISOR DE BASE (SENTINEL)
          {
            path: 'supervisor-base',
            element: <RutaProtegida rolesPermitidos={['SUPERVISOR', 'ADMIN_BASE', 'COMANDANTE']} />,
            children: [
              { path: 'dashboard', element: <DashboardSupervisorBase /> },
              { path: 'censo-vehicular', element: <CensoVehicularSupervisor /> },
              { path: 'censo-personas', element: <CensoPersonasSupervisor /> },
              { path: 'pases', element: <PaseTemporalSupervisor /> }
            ]
          },
          // SOCIO
          {
            path: 'socio',
            element: <RutaProtegida rolesPermitidos={['SOCIO']} />,
            children: [
              { path: 'portal',       element: <PortalSocio /> },
              { path: 'infracciones', element: <InfraccionesSocio /> },
              { path: 'accesos',      element: <HistorialAccesos /> }
            ]
          },
          // COMBUSTIBLE (AEGIS FUEL)
          {
            path: 'combustible',
            element: <RutaProtegida rolesPermitidos={['BOMBERO', 'ADMIN_BASE', 'COMANDANTE', 'SUPERVISOR', 'SUPERVISOR_BOMBEROS']} />,
            children: [
              { path: '', element: <DashboardBombero /> },
              { path: 'dashboard', element: <DashboardBombero /> },
              { path: 'reportes', element: <ReporteCombustible /> },
              { path: 'aprobaciones', element: <ColaAprobacionesCombustible /> },
              {
                path: 'tanques',
                element: <RutaProtegida rolesPermitidos={['COMANDANTE', 'ADMIN_BASE', 'SUPERVISOR_BOMBEROS']} />,
                children: [
                  { path: '', element: <GestionTanques /> }
                ]
              }
            ]
          },
          // SUPERVISOR DE BOMBEROS (AEGIS FUEL)
          {
            path: 'combustible-supervisor',
            element: <RutaProtegida rolesPermitidos={['SUPERVISOR_BOMBEROS', 'COMANDANTE', 'ADMIN_BASE']} />,
            children: [
              { path: 'dashboard', element: <DashboardSupervisorBomberos /> }
            ]
          },
          // PARQUE AUTOMOTOR
          {
            path: 'parque-automotor',
            element: <RutaProtegida rolesPermitidos={['COMANDANTE', 'ADMIN_BASE', 'ADMIN_ENTIDAD', 'SUPERVISOR', 'SUPERVISOR_BOMBEROS']} />,
            children: [
              { path: '', element: <ParqueAutomotor /> }
            ]
          },
          // AJUSTES
          {
            path: 'ajustes',
            element: <Ajustes />
          }
        ]
      }
    ]
  },
  {
    path: '/portal-evento/:serial',
    element: <PortalEvento />
  },
  {
    path: '/portal/pase/:token',
    element: <PortalPase />
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
