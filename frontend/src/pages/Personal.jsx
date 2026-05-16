import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Boton } from '../components/ui/Boton';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import {
  UserCircle, Plus, UserCog, Hash, Phone, Building2, Power, RotateCcw,
  UserMinus, BadgeCheck, Search, ChevronLeft, ChevronRight, MapPin,
  Star, AlertTriangle, Edit2, X, Check,
  TrendingUp, Shield, Award, Clock, Zap, AlertCircle, Users,
  ShieldAlert, Mail, PlusCircle, HandMetal
} from 'lucide-react';
import personalService from '../services/personal.service';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';


// ─── CONSTANTES Y DATOS DE REFERENCIA ─────────────────────────────────────────

const TIPOS_INCENTIVO = [
  { valor: 'bono_eficiencia', etiqueta: 'Bono Efic.', icono: Zap },
  { valor: 'reconocimiento', etiqueta: 'Reconoc.', icono: Award },
  { valor: 'dia_libre', etiqueta: 'Día Libre', icono: Star },
  { valor: 'ascenso', etiqueta: 'Ascenso', icono: TrendingUp },
];

const TIPOS_SANCION = [
  { valor: 'amonestacion', etiqueta: 'Amonest.', color: 'text-amber-400' },
  { valor: 'suspension_temporal', etiqueta: 'Suspensión', color: 'text-orange-400' },
  { valor: 'relevo_inmediato', etiqueta: 'Relevo', color: 'text-danger' },
  { valor: 'reportar_autoridades', etiqueta: 'Autoridades', color: 'text-red-400' },
];

const ETIQUETA_INCENTIVO = {
  bono_eficiencia: { label: 'BONO EFIC.', color: 'text-primary bg-primary/10 border-primary/20' },
  reconocimiento:  { label: 'RECONOC.',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  dia_libre:       { label: 'DÍA LIBRE', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  ascenso:         { label: 'ASCENSO',   color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
};

const ETIQUETA_SANCION = {
  amonestacion:         { label: 'AMONEST.',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  suspension_temporal:  { label: 'SUSPENSIÓN', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  relevo_inmediato:     { label: 'RELEVO',     color: 'text-danger bg-danger/10 border-danger/20' },
  reportar_autoridades: { label: 'AUTORIDADES',color: 'text-red-600 bg-red-600/10 border-red-600/20' },
};

const ESTADO_SANCION = {
  activa:  { label: 'ACTIVA',   color: 'text-danger' },
  cumplida:{ label: 'CUMPLIDA', color: 'text-primary' },
  apelada: { label: 'APELADA',  color: 'text-amber-400' },
};

const getRolStyles = (rol) => {
  switch (rol) {
    case 'ADMIN_BASE':         return { badge: 'text-primary bg-primary/10 border-primary/20',       avatar: 'text-primary bg-primary/10 border-primary/20',       bar: 'bg-primary' };
    case 'SUPERVISOR':         return { badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20', avatar: 'text-amber-400 bg-amber-400/10 border-amber-400/20', bar: 'bg-amber-400' };
    case 'PARQUERO':           return { badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', avatar: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', bar: 'bg-emerald-400' };
    case 'ALCABALA':           return { badge: 'text-sky-400 bg-sky-400/10 border-sky-400/20',       avatar: 'text-sky-400 bg-sky-400/10 border-sky-400/20',       bar: 'bg-sky-400' };
    case 'ADMIN_ENTIDAD':      return { badge: 'text-purple-400 bg-purple-400/10 border-purple-400/20', avatar: 'text-purple-400 bg-purple-400/10 border-purple-400/20', bar: 'bg-purple-400' };
    case 'SUPERVISOR_PARQUEROS': return { badge: 'text-amber-500 bg-amber-500/10 border-amber-500/20', avatar: 'text-amber-500 bg-amber-500/10 border-amber-500/20', bar: 'bg-amber-500' };
    default:                   return { badge: 'text-text-muted bg-white/5 border-white/5',           avatar: 'text-text-muted bg-white/5 border-white/5',           bar: 'bg-text-muted' };
  }
};

// ─── COMPONENTES TÁCTICOS ─────────────────────────────────────────────────────

const TacticalKPIs = ({ personal }) => {
  const stats = useMemo(() => {
    const total = personal.length;
    const activos = personal.filter(p => p.activo).length;
    const parqueros = personal.filter(p => p.rol === 'PARQUERO').length;
    const conZona = personal.filter(p => p.zona_asignada_id).length;

    return [
      { label: 'Operativos Totales', val: total, icon: Users, color: 'text-primary', sub: 'Personal registrado' },
      { label: 'Activos Hoy', val: activos, icon: Zap, color: 'text-success', sub: 'Acceso autorizado' },
      { label: 'Parqueros en Campo', val: parqueros, icon: MapPin, color: 'text-sky-400', sub: 'Control de puestos' },
      { label: 'Zonas Cubiertas', val: conZona, icon: Shield, color: 'text-amber-400', sub: 'Asignaciones activas' },
    ];
  }, [personal]);

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {stats.map((s, i) => (
        <div key={i} className="p-4 bg-bg-card/40 border border-white/5 rounded-2xl flex items-center gap-4 group hover:bg-bg-high/80 transition-all border-b-2 border-b-transparent hover:border-b-primary/50">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-black/40 border border-white/5", s.color)}>
            <s.icon size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-text-main leading-tight">{s.val}</div>
            <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">{s.label}</div>
            <div className="text-[8px] text-text-muted opacity-40 uppercase font-bold mt-0.5">{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── CONFIGURACIÓN DE TABS POR ROL ───────────────────────────────────────────

const TABS_POR_ROL = {
  PARQUERO:           ['kpis', 'zona', 'incentivos', 'sanciones', 'editar'],
  SUPERVISOR_PARQUEROS:['kpis', 'zona', 'incentivos', 'sanciones', 'editar'],
  ALCABALA:           ['kpis', 'incentivos', 'sanciones', 'editar'],
  SUPERVISOR:         ['kpis', 'incentivos', 'sanciones', 'editar'],
  ADMIN_BASE:         ['editar'],
  ADMIN_ENTIDAD:      ['editar'],
  COMANDANTE:         ['editar'],
};

const INFO_SECUNDARIA_ROL = {
  PARQUERO:            (m) => m.zona_nombre ? `Zona: ${m.zona_nombre}` : 'Sin zona asignada',
  SUPERVISOR_PARQUEROS:(m) => m.zona_nombre ? `Supervisando: ${m.zona_nombre}` : 'Supervisión general',
  ALCABALA:            (m) => m.cedula ? `Operador de acceso` : '',
  SUPERVISOR:          (_) => 'Supervisor de ronda',
  ADMIN_BASE:          (_) => 'Administrador de Base',
  ADMIN_ENTIDAD:       (_) => 'Administrador de Entidad',
  COMANDANTE:          (_) => 'Comandante de Base',
};

// ─── MODAL DE GESTIÓN POR ROL ────────────────────────────────────────────────

const ModalGestion = ({ miembro, isOpen, onClose, zonas, onUpdate, userActual }) => {
  const [tab, setTab] = useState('kpis');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [details, setDetails] = useState({ kpis: null, incentivos: [], sanciones: [] });
  const [zonaSeleccionada, setZonaSeleccionada] = useState(miembro?.zona_asignada_id || '');
  const [guardandoAction, setGuardandoAction] = useState(false);
  const [formEdit, setFormEdit] = useState({ nombre: miembro?.nombre || '', apellido: miembro?.apellido || '', email: miembro?.email || '', telefono: miembro?.telefono || '' });
  const [formInc, setFormInc] = useState({ tipo: '', descripcion: '' });
  const [formSanc, setFormSanc] = useState({ tipo: '', motivo: '', ejecutar_inmediato: false });

  const tabsDisponibles = (TABS_POR_ROL[miembro?.rol] || ['editar']).map(id => ({
    kpis:       { id: 'kpis',       label: 'KPIs',       icon: TrendingUp },
    zona:       { id: 'zona',       label: 'Zona',       icon: MapPin },
    incentivos: { id: 'incentivos', label: 'Incentivos', icon: Star },
    sanciones:  { id: 'sanciones', label: 'Sanciones',  icon: ShieldAlert },
    editar:     { id: 'editar',     label: 'Editar',     icon: Edit2 },
  }[id]));

  useEffect(() => {
    if (!isOpen || !miembro) return;
    setTab(tabsDisponibles[0]?.id || 'editar');
    setFormEdit({ nombre: miembro.nombre, apellido: miembro.apellido, email: miembro.email || '', telefono: miembro.telefono || '' });
    setZonaSeleccionada(miembro.zona_asignada_id || '');
    setLoadingDetails(true);
    Promise.all([
      personalService.obtenerKpis(miembro.id).catch(() => null),
      personalService.listarIncentivos(miembro.id).catch(() => []),
      personalService.listarSanciones(miembro.id).catch(() => []),
    ]).then(([k, inc, sanc]) => setDetails({ kpis: k, incentivos: inc, sanciones: sanc }))
      .finally(() => setLoadingDetails(false));
  }, [isOpen, miembro?.id]);

  if (!miembro) return null;

  const handleEdit = async (e) => {
    e.preventDefault(); setGuardandoAction(true);
    try {
      const updated = await personalService.actualizar(miembro.id, { ...formEdit, nombre: formEdit.nombre.toUpperCase(), apellido: formEdit.apellido.toUpperCase() });
      onUpdate(updated); toast.success('Perfil actualizado'); onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al actualizar'); }
    finally { setGuardandoAction(false); }
  };

  const handleAsignarZona = async () => {
    setGuardandoAction(true);
    try {
      const updated = await personalService.asignarZona(miembro.id, zonaSeleccionada || null);
      onUpdate(updated); toast.success('Zona asignada');
    } catch (err) { toast.error(err.response?.data?.detail || 'Fallo de asignación'); }
    finally { setGuardandoAction(false); }
  };

  const handleInc = async (e) => {
    e.preventDefault(); setGuardandoAction(true);
    try {
      await personalService.agregarIncentivo(miembro.id, formInc);
      setFormInc({ tipo: '', descripcion: '' }); toast.success('Incentivo otorgado');
      const inc = await personalService.listarIncentivos(miembro.id).catch(() => []);
      setDetails(d => ({ ...d, incentivos: inc }));
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al registrar'); }
    finally { setGuardandoAction(false); }
  };

  const handleSanc = async (e) => {
    e.preventDefault(); setGuardandoAction(true);
    try {
      await personalService.agregarSancion(miembro.id, formSanc);
      setFormSanc({ tipo: '', motivo: '', ejecutar_inmediato: false }); toast.success('Sanción aplicada');
      const sanc = await personalService.listarSanciones(miembro.id).catch(() => []);
      setDetails(d => ({ ...d, sanciones: sanc }));
    } catch (err) { toast.error(err.response?.data?.detail || 'Error en sanción'); }
    finally { setGuardandoAction(false); }
  };

  const estilos = getRolStyles(miembro.rol);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${miembro.nombre} ${miembro.apellido}`} className="sm:max-w-2xl">
      {/* Header del operativo */}
      <div className="flex items-center gap-3 p-3 bg-bg-card/60 rounded-xl border border-white/5 mb-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center border shrink-0', estilos.avatar)}>
          <UserCircle size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border', estilos.badge)}>
              {miembro.rol.replace(/_/g, ' ')}
            </span>
            <span className={cn('text-[8px] font-black uppercase', miembro.activo ? 'text-success' : 'text-danger')}>
              {miembro.activo ? '● ACTIVO' : '● INACTIVO'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-text-muted/60 uppercase tracking-wider">
            <span className="flex items-center gap-1"><Hash size={9} className="text-primary/50" /> {miembro.cedula}</span>
            {miembro.telefono && <span className="flex items-center gap-1"><Phone size={9} /> {miembro.telefono}</span>}
          </div>
        </div>
      </div>

      {/* Tabs según rol */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none pb-1">
        {tabsDisponibles.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all',
              tab === t.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:text-text-main hover:bg-white/5 border border-transparent')}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      {loadingDetails ? (
        <div className="flex items-center justify-center py-12 opacity-30">
          <Clock size={28} className="animate-spin mr-2" />
          <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── TAB KPIs ── */}
          {tab === 'kpis' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block mb-1">Días Operativo</span>
                  <span className="text-2xl font-black text-primary">{details.kpis?.dias_activo || 0}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block mb-1">Incentivos</span>
                  <span className="text-2xl font-black text-amber-400">{details.kpis?.total_incentivos || 0}</span>
                </div>
                {['PARQUERO','SUPERVISOR_PARQUEROS'].includes(miembro.rol) && (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Asig. Manuales</span>
                      {details.kpis?.asignaciones_manuales > 10 && <AlertTriangle size={10} className="text-danger animate-pulse" />}
                    </div>
                    <span className={cn('text-2xl font-black', details.kpis?.asignaciones_manuales > 10 ? 'text-danger' : 'text-sky-400')}>
                      {details.kpis?.asignaciones_manuales || 0}
                    </span>
                  </div>
                )}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block mb-1">Sanciones Totales</span>
                  <span className={cn('text-2xl font-black', details.kpis?.total_sanciones > 0 ? 'text-danger' : 'text-white/20')}>{details.kpis?.total_sanciones || 0}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block mb-1">Alertas Activas</span>
                  <span className={cn('text-2xl font-black', details.kpis?.sanciones_activas > 0 ? 'text-danger' : 'text-success/30')}>{details.kpis?.sanciones_activas || 0}</span>
                </div>
              </div>
              {(details.kpis?.ultimo_incentivo || details.kpis?.ultima_sancion) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {details.kpis?.ultimo_incentivo && (
                    <div className="flex items-center gap-3 p-3 bg-amber-400/5 border border-amber-400/10 rounded-xl">
                      <Star size={14} className="text-amber-400 shrink-0" />
                      <div>
                        <p className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Último Incentivo</p>
                        <p className="text-[10px] font-bold text-amber-400/80 uppercase">{details.kpis.ultimo_incentivo.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  )}
                  {details.kpis?.ultima_sancion && (
                    <div className="flex items-center gap-3 p-3 bg-danger/5 border border-danger/10 rounded-xl">
                      <ShieldAlert size={14} className="text-danger shrink-0" />
                      <div>
                        <p className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Última Sanción</p>
                        <p className="text-[10px] font-bold text-danger/80 uppercase">{details.kpis.ultima_sancion.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB ZONA ── */}
          {tab === 'zona' && (
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><MapPin size={18} /></div>
                <div>
                  <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Ubicación Táctica</p>
                  <p className="text-sm font-black text-text-main uppercase">{miembro.zona_nombre || 'Sin asignación'}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 w-full">
                <select className="flex-1 h-10 bg-bg-card border border-white/10 rounded-xl px-4 text-xs font-bold text-text-main focus:ring-1 focus:ring-primary outline-none appearance-none w-full"
                  value={zonaSeleccionada} onChange={e => setZonaSeleccionada(e.target.value)}>
                  <option value="">— DESASIGNAR (PATRULLAJE) —</option>
                  {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
                <Boton onClick={handleAsignarZona} isLoading={guardandoAction} className="h-10 px-6 text-[10px] uppercase font-black tracking-widest w-full sm:w-auto">Asignar</Boton>
              </div>
            </div>
          )}

          {/* ── TAB INCENTIVOS ── */}
          {tab === 'incentivos' && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-amber-400/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <PlusCircle size={14} className="text-amber-400" />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Añadir Reconocimiento</span>
                </div>
                <form onSubmit={handleInc} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-4">
                    <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1 block mb-1">Tipo de Incentivo</label>
                    <select className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main focus:ring-1 focus:ring-amber-400 outline-none"
                      required value={formInc.tipo} onChange={e => setFormInc({ ...formInc, tipo: e.target.value })}>
                      <option value="">SELECCIONAR...</option>
                      {TIPOS_INCENTIVO.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1 block mb-1">Descripción del mérito</label>
                    <input className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main outline-none focus:ring-1 focus:ring-amber-400"
                      required placeholder="Ej: Excelente manejo de flujo..." value={formInc.descripcion} onChange={e => setFormInc({ ...formInc, descripcion: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 sm:pt-4">
                    <Boton type="submit" isLoading={guardandoAction} className="h-10 w-full bg-amber-400 text-bg-app hover:bg-amber-500 text-[10px] font-black uppercase tracking-widest mt-[5px]">Registrar</Boton>
                  </div>
                </form>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {details.incentivos.length === 0
                  ? <div className="col-span-full py-8 text-center border border-dashed border-white/5 rounded-xl"><p className="text-[9px] text-text-muted italic uppercase opacity-30">Sin registros</p></div>
                  : details.incentivos.map(inc => {
                    const st = ETIQUETA_INCENTIVO[inc.tipo] || { label: inc.tipo, color: 'bg-white/5 text-text-muted' };
                    return (
                      <div key={inc.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
                        <div className={cn('px-2 py-0.5 rounded-md text-[7px] font-black uppercase shrink-0 mt-0.5', st.color)}>{st.label}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-text-main leading-tight truncate">{inc.descripcion}</p>
                          <p className="text-[7px] text-text-muted mt-1 uppercase font-bold opacity-40">{new Date(inc.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── TAB SANCIONES ── */}
          {tab === 'sanciones' && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-danger/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert size={14} className="text-danger" />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Aplicar Medida Disciplinaria</span>
                </div>
                <form onSubmit={handleSanc} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-4">
                    <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1 block mb-1">Tipo de Falta</label>
                    <select className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main focus:ring-1 focus:ring-danger outline-none"
                      required value={formSanc.tipo} onChange={e => setFormSanc({ ...formSanc, tipo: e.target.value })}>
                      <option value="">SELECCIONAR...</option>
                      {TIPOS_SANCION.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1 block mb-1">Motivo detallado</label>
                    <input className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main outline-none focus:ring-1 focus:ring-danger"
                      required placeholder="Especifique la infracción..." value={formSanc.motivo} onChange={e => setFormSanc({ ...formSanc, motivo: e.target.value })} />
                  </div>
                  <div className="sm:col-span-12 flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    {formSanc.tipo === 'relevo_inmediato' ? (
                      <label className="flex items-center gap-2 p-2 bg-danger/10 border border-danger/20 rounded-lg cursor-pointer">
                        <input type="checkbox" className="accent-danger" checked={formSanc.ejecutar_inmediato} onChange={e => setFormSanc({ ...formSanc, ejecutar_inmediato: e.target.checked })} />
                        <span className="text-[8px] font-black text-danger uppercase">Ejecutar Cierre Automático</span>
                      </label>
                    ) : <div />}
                    <Boton type="submit" isLoading={guardandoAction} className="h-10 px-6 bg-danger text-white hover:bg-red-600 text-[10px] font-black uppercase tracking-widest">Sancionar</Boton>
                  </div>
                </form>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {details.sanciones.length === 0
                  ? <div className="col-span-full py-8 text-center border border-dashed border-white/5 rounded-xl"><p className="text-[9px] text-text-muted italic uppercase opacity-30">Sin sanciones</p></div>
                  : details.sanciones.map(s => {
                    const st = ETIQUETA_SANCION[s.tipo] || { label: s.tipo, color: 'bg-white/5 text-text-muted' };
                    const status = ESTADO_SANCION[s.estado] || { label: s.estado, color: 'text-text-muted' };
                    return (
                      <div key={s.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className={cn('px-2 py-0.5 rounded-md text-[7px] font-black uppercase', st.color)}>{st.label}</div>
                          <div className={cn('text-[7px] font-black uppercase', status.color)}>{status.label}</div>
                        </div>
                        <p className="text-[10px] font-bold text-text-main leading-tight truncate">{s.motivo}</p>
                        <p className="text-[7px] text-text-muted uppercase font-bold opacity-40">{new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── TAB EDITAR ── */}
          {tab === 'editar' && (
            <form onSubmit={handleEdit} className="bg-white/5 border border-white/5 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1">Nombres</label>
                <input className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main outline-none focus:ring-1 focus:ring-primary"
                  required value={formEdit.nombre} onChange={e => setFormEdit({ ...formEdit, nombre: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1">Apellidos</label>
                <input className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main outline-none focus:ring-1 focus:ring-primary"
                  required value={formEdit.apellido} onChange={e => setFormEdit({ ...formEdit, apellido: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1">Teléfono</label>
                <input className="w-full h-10 bg-bg-card border border-white/10 rounded-xl px-3 text-xs font-bold text-text-main outline-none focus:ring-1 focus:ring-primary"
                  value={formEdit.telefono} onChange={e => setFormEdit({ ...formEdit, telefono: e.target.value })} />
              </div>
              <div className="flex items-end sm:pt-4">
                <Boton type="submit" isLoading={guardandoAction} className="h-10 w-full text-[10px] font-black uppercase tracking-widest">Guardar Cambios</Boton>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
};

// ─── TARJETA SIMPLE DE MIEMBRO ────────────────────────────────────────────────

const MiembroCard = ({ miembro, userActual, zonas, onUpdate, onToggleActivo, onEliminar }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const estilos = getRolStyles(miembro.rol);
  const estaInactivo = !miembro.activo;
  const infoSecundaria = (INFO_SECUNDARIA_ROL[miembro.rol] || (() => ''))(miembro);

  return (
    <>
      <div className={cn(
        'flex items-center gap-3 p-3 bg-bg-card/40 border border-white/5 rounded-2xl group transition-all duration-200 relative',
        estaInactivo ? 'border-danger/20' : 'hover:border-white/10 hover:bg-bg-high/60'
      )}>
        {/* Barra lateral de estado */}
        <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', estaInactivo ? 'bg-danger' : estilos.bar)} />

        {/* Avatar */}
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center border shrink-0 ml-1',
          estaInactivo ? 'bg-danger/10 border-danger/20 text-danger' : estilos.avatar)}>
          <UserCircle size={22} />
        </div>

        {/* Identidad */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black text-text-main uppercase leading-none">{miembro.nombre} {miembro.apellido}</h3>
            <span className={cn('px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border leading-none',
              estaInactivo ? 'text-danger bg-danger/10 border-danger/20' : estilos.badge)}>
              {estaInactivo ? 'INACTIVO' : miembro.rol.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-text-muted/60 uppercase tracking-wider flex-wrap">
            <span className="flex items-center gap-1"><Hash size={9} className="text-primary/50" /> {miembro.cedula}</span>
            {infoSecundaria && <span className="flex items-center gap-1 text-sky-400/80"><MapPin size={9} /> {infoSecundaria}</span>}
            {miembro.telefono && <span className="flex items-center gap-1"><Phone size={9} /> {miembro.telefono}</span>}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 shrink-0">
          {miembro.rol !== 'ALCABALA' && (
            <button
              onClick={() => setModalOpen(true)}
              className="h-8 px-3 rounded-xl flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all text-[9px] font-black uppercase tracking-widest"
              title="Gestionar operativo"
            >
              <UserCog size={13} /> <span className="hidden sm:inline">Gestionar</span>
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onToggleActivo(miembro.id); }}
            className={cn('h-8 w-8 rounded-xl flex items-center justify-center transition-all',
              miembro.activo
                ? 'bg-warning/10 text-warning hover:bg-warning/20 border border-warning/10'
                : 'bg-success/10 text-success hover:bg-success/20 border border-success/10')}
            title={miembro.activo ? 'Pausar' : 'Reactivar'}
          >
            {miembro.activo ? <Power size={14} /> : <RotateCcw size={14} />}
          </button>

          {userActual.rol === 'COMANDANTE' && (
            <button
              onClick={(e) => { e.stopPropagation(); onEliminar(miembro.id, miembro.nombre); }}
              className="h-8 w-8 bg-danger/10 text-danger hover:bg-danger/20 border border-danger/10 rounded-xl flex items-center justify-center transition-all"
              title="Dar de baja definitiva"
            >
              <UserMinus size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Modal de gestión según rol */}
      <ModalGestion
        miembro={miembro}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        zonas={zonas}
        onUpdate={onUpdate}
        userActual={userActual}
      />
    </>
  );
};




export default function Personal() {
  const { user: userActual } = useAuthStore();
  const [personal, setPersonal] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalCreateOpen, setIsModalCreateOpen] = useState(false);

  const [nuevoMiembro, setNuevoMiembro] = useState({
    cedula: '', nombre: '', apellido: '', email: '',
    telefono: '', rol: '', entidad_id: null, password: ''
  });

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const skip = page * limit;
      const data = await personalService.listar({ skip, limit, search });
      setPersonal(data);
      setHasMore(data.length === limit);

      if (['COMANDANTE', 'ADMIN_BASE'].includes(userActual.rol)) {
        try { const res = await api.get('/entidades'); setEntidades(res.data); } catch {}
      }

      // LISTADO DE ZONAS (FIX 403: Endpoint adaptado según rol)
      try {
        const resZonas = await api.get('/zonas'); // El backend ya filtra por entidad si el rol es ADMIN_ENTIDAD
        setZonas(resZonas.data);
      } catch (err) {
        console.error("Fallo al cargar zonas tácticas:", err);
      }

    } catch {
      toast.error('Fallo en sincronización de Fuerza de Tareas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(fetchData, search ? 500 : 0);
    return () => clearTimeout(delay);
  }, [page, search]);

  const handleToggleActivo = async (id) => {
    try {
      const updated = await personalService.toggleActivo(id);
      setPersonal(prev => prev.map(m => m.id === id ? updated : m));
      toast.success("Estado táctico actualizado");
    } catch { toast.error("Fallo al cambiar privilegios"); }
  };

  const handleEliminar = async (id, nombre) => {
    if (!window.confirm(`¿Confirma protocolo de BAJA DEFINITIVA para ${nombre}?`)) return;
    try {
      await personalService.eliminar(id);
      setPersonal(prev => prev.filter(m => m.id !== id));
      toast.success("Baja procesada exitosamente");
    } catch { toast.error("Error en proceso de baja"); }
  };

  const handleUpdateMiembro = (updated) => {
    setPersonal(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const handleCrearPersonal = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...nuevoMiembro, password: nuevoMiembro.cedula };
      if (userActual.rol === 'ADMIN_ENTIDAD' && userActual.entidad_id)
        payload.entidad_id = userActual.entidad_id;

      await personalService.crear(payload);
      setIsModalCreateOpen(false);
      setNuevoMiembro({ cedula: '', nombre: '', apellido: '', email: '', telefono: '', rol: '', entidad_id: null, password: '' });
      fetchData();
      toast.success('Alta de personal completada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error en protocolo de alta');
    }
  };

  const renderRolesDisponibles = () => {
    if (['COMANDANTE', 'ADMIN_BASE'].includes(userActual.rol)) {
      return (
        <>
          <option value="ADMIN_BASE">ADMINISTRADOR DE BASE</option>
          <option value="SUPERVISOR">SUPERVISOR DE GUARDIA</option>
          <option value="PARQUERO">PERSONA DE ACCESO (PARQUERO)</option>
          <option value="ALCABALA">OPERADOR DE ALCABALA</option>
          <option value="ADMIN_ENTIDAD">ADMINISTRADOR DE ENTIDAD</option>
          <option value="SUPERVISOR_PARQUEROS">SUPERVISOR DE PARQUEROS</option>
          <option value="SOCIO">SOCIO</option>
        </>
      );
    }
    return (
      <>
        <option value="SUPERVISOR_PARQUEROS">DIRECTOR DE OPERACIONES (SUPERVISOR)</option>
        <option value="PARQUERO">OPERADOR AUXILIAR (PARQUERO)</option>
      </>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 max-w-[1400px] mx-auto animate-in fade-in duration-500">

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-bg-card/30 p-4 md:p-5 rounded-2xl border border-white/5">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight uppercase">
            <div className="p-2 bg-primary/10 rounded-xl shrink-0">
              <UserCog className="text-primary" size={24} />
            </div>
            Fuerza de Tareas
          </h1>
          <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1 font-bold">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", personal.length > 0 ? "bg-success animate-pulse" : "bg-text-muted")} />
            Gestión de personal operativo — Operación Activa
          </p>
        </div>
        <Boton
          onClick={() => setIsModalCreateOpen(true)}
          className="gap-2 h-11 px-6 w-full sm:w-auto shrink-0 bg-primary text-bg-app font-black uppercase tracking-widest text-[11px] rounded-xl shadow-tactica hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={18} />
          <span>Añadir Operativo</span>
        </Boton>
      </header>

      <TacticalKPIs personal={personal} />

      <div className="flex gap-4 items-center bg-bg-card/20 p-2 rounded-2xl border border-white/5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="BUSCAR POR NOMBRE O CÉDULA..."
            className="w-full h-12 bg-bg-card border border-bg-high/10 rounded-xl pl-12 pr-4 text-sm font-bold text-text-main focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-text-muted/40 uppercase"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      <section className="space-y-3">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
          ))
        ) : (
          <>
            {personal.map(miembro => (
              <MiembroCard 
                key={miembro.id}
                miembro={miembro}
                userActual={userActual}
                zonas={zonas}
                onUpdate={handleUpdateMiembro}
                onToggleActivo={handleToggleActivo}
                onEliminar={handleEliminar}
              />
            ))}

            {personal.length === 0 && (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-bg-card/20">
                <UserCog size={48} className="mx-auto text-text-muted mb-4 opacity-15" />
                <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                  Sin operativos registrados en este sector
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {!loading && (personal.length > 0 || page > 0) && (
        <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-4">
          <Boton variant="ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
            className="gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
            <ChevronLeft size={16} /> Anterior
          </Boton>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Sector Acceso</span>
            <span className="text-sm font-display font-black text-primary">PÁGINA {page + 1}</span>
          </div>
          <Boton variant="ghost" disabled={!hasMore} onClick={() => setPage(p => p + 1)}
            className="gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
            Siguiente <ChevronRight size={16} />
          </Boton>
        </div>
      )}

      <Modal isOpen={isModalCreateOpen} onClose={() => setIsModalCreateOpen(false)} title="PROTOCOLO DE ALTA — PERSONAL">
        <form onSubmit={handleCrearPersonal} className="space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <BadgeCheck size={13} className="text-primary" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Identificación y Rango</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Documento de Identidad" required placeholder="V-0000000"
                value={nuevoMiembro.cedula}
                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, cedula: e.target.value.toUpperCase() })}
              />
              <Input label="Teléfono" placeholder="0412-0000000"
                value={nuevoMiembro.telefono}
                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, telefono: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombres" required placeholder="EJ: PEDRO JAVIER"
                value={nuevoMiembro.nombre}
                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, nombre: e.target.value.toUpperCase() })}
              />
              <Input label="Apellidos" required placeholder="EJ: RODRIGUEZ"
                value={nuevoMiembro.apellido}
                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, apellido: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1 opacity-60">Rango Operativo</label>
                <select
                  className="w-full h-11 bg-bg-card border border-white/10 rounded-xl px-3 text-sm font-bold text-text-main focus:ring-1 focus:ring-primary outline-none appearance-none transition-all"
                  required value={nuevoMiembro.rol}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, rol: e.target.value })}
                >
                  <option value="">SELECCIONE...</option>
                  {renderRolesDisponibles()}
                </select>
              </div>
              <Input label="Email del Operador" type="email" placeholder="operador@bagfm.com"
                value={nuevoMiembro.email}
                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, email: e.target.value })}
              />
            </div>

            {(['PARQUERO','SUPERVISOR_PARQUEROS','ADMIN_ENTIDAD','ALCABALA'].includes(nuevoMiembro.rol)) &&
             (['COMANDANTE','ADMIN_BASE'].includes(userActual.rol)) && (
              <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1 opacity-60">Asignación de Destino</label>
                <select
                  className="w-full h-11 bg-bg-card border border-white/10 rounded-xl px-3 text-sm font-bold text-text-main focus:ring-1 focus:ring-primary outline-none appearance-none transition-all"
                  required value={nuevoMiembro.entidad_id || ''}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, entidad_id: e.target.value })}
                >
                  <option value="">ASIGNAR ENTIDAD...</option>
                  {entidades.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 space-y-3">
            <Boton type="submit" className="w-full h-14 bg-primary text-bg-app font-black uppercase tracking-[0.2em] rounded-xl shadow-tactica">
              Finalizar Alta de Personal
            </Boton>
            <p className="text-[9px] text-center text-text-muted uppercase font-bold tracking-widest opacity-50 italic">
              La cédula se usará como clave de acceso inicial.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
