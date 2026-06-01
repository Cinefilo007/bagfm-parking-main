import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, Compass, RefreshCw, AlertTriangle, CheckCircle2, 
  Send, Camera, Eye, PlusCircle, Power, User, ShieldAlert,
  Flame, HardDrive, BarChart3, Clock, XCircle, ClipboardList
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { combustibleService } from '../../services/combustible.service';
import { alcabalaService } from '../../services/alcabala.service';

export default function DashboardBombero() {
  const [tanques, setTanques] = useState([]);
  const [tieneLecturaSemana, setTieneLecturaSemana] = useState(true);
  const [cargandoTanques, setCargandoTanques] = useState(true);
  
  // Estado para la declaraciÃ³n inicial de inventario
  const [declarandoInventario, setDeclarandoInventario] = useState(false);
  const [lecturasForm, setLecturasForm] = useState({});
  const [cargandoLectura, setCargandoLectura] = useState(false);

  // Estados de bÃºsqueda y suministro
  const [placaBusqueda, setPlacaBusqueda] = useState('');
  const [placaNoEncontrada, setPlacaNoEncontrada] = useState(false);
  const [buscandoVehiculo, setBuscandoVehiculo] = useState(false);
  const [vehiculoEncontrado, setVehiculoEncontrado] = useState(null);
  
  // Historial Bombero
  const [historialBombero, setHistorialBombero] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  
  // Formulario de Abastecimiento
  const [kilometraje, setKilometraje] = useState('');
  const [litrosCargar, setLitrosCargar] = useState('');
  const [tanqueSeleccionado, setTanqueSeleccionado] = useState('');
  const [fotoKilometraje, setFotoKilometraje] = useState(null);
  const [fotoKilometrajeUrl, setFotoKilometrajeUrl] = useState('');
  const [fotoMaquina, setFotoMaquina] = useState(null);
  const [fotoMaquinaUrl, setFotoMaquinaUrl] = useState('');
  
  const [iaLoadOdo, setIaLoadOdo] = useState(false);
  const [subiendoFotoK, setSubiendoFotoK] = useState(false);
  const [subiendoFotoM, setSubiendoFotoM] = useState(false);
  const [cargandoSuministro, setCargandoSuministro] = useState(false);
  
  // Solicitud vinculada para bypass temporal
  const [solicitudVinculada, setSolicitudVinculada] = useState(null);

  // Estados de Bandeja de Solicitudes
  const [solicitudesEspera, setSolicitudesEspera] = useState([]);
  const [solicitudesAprobadas, setSolicitudesAprobadas] = useState([]);
  const [cargandoBandeja, setCargandoBandeja] = useState(false);
  const [vistaTab, setVistaTab] = useState('surtir'); // 'surtir' | 'bandeja'

  // Modal de Nueva Solicitud de Emergencia
  const [modalSolicitud, setModalSolicitud] = useState(false);
  const [formSolicitud, setFormSolicitud] = useState({
    placa: '',
    cantidad_solicitada: '',
    motivo: '',
    nombre_conductor_manual: '',
    cedula_conductor_manual: '',
    marca_manual: '',
    modelo_manual: '',
    color_manual: ''
  });
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  // Refs para inputs de cÃ¡mara forzada
  const fileOdoRef = useRef(null);
  const fileMaquinaRef = useRef(null);

  useEffect(() => {
    cargarDatosTanques();
    cargarBandejaSolicitudes();
    cargarHistorialBombero();
  }, []);

  const cargarHistorialBombero = async () => {
    setCargandoHistorial(true);
    try {
      const res = await combustibleService.obtenerHistorialBombero(5);
      setHistorialBombero(res.data || []);
    } catch (err) {
      console.error("Error cargando historial bombero:", err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const cargarDatosTanques = async () => {
    setCargandoTanques(true);
    try {
      const res = await combustibleService.getTanques();
      setTanques(res.data || []);
      setTieneLecturaSemana(res.tiene_lectura_semana);
      if (res.data && res.data.length > 0) {
        setTanqueSeleccionado(res.data[0].id);
        // Pre-rellenar formulario de declaraciÃ³n si aplica
        const formInit = {};
        res.data.forEach(t => {
          formInit[t.id] = '';
        });
        setLecturasForm(formInit);
      }
    } catch (e) {
      toast.error("No se pudieron cargar los datos de los tanques");
    } finally {
      setCargandoTanques(false);
    }
  };

  const cargarBandejaSolicitudes = async () => {
    setCargandoBandeja(true);
    try {
      const datos = await combustibleService.getSolicitudesBombero();
      // Filtrar pendientes y aprobadas
      setSolicitudesEspera(datos.filter(s => s.estado === 'pendiente'));
      setSolicitudesAprobadas(datos.filter(s => s.estado === 'aprobada'));
    } catch (e) {
      console.error("Error cargando solicitudes del bombero:", e);
    } finally {
      setCargandoBandeja(false);
    }
  };

  const handleDeclararInventario = async (e) => {
    e.preventDefault();
    setCargandoLectura(true);
    try {
      for (const [tanqueId, cant] of Object.entries(lecturasForm)) {
        if (!cant || isNaN(cant) || parseFloat(cant) < 0) {
          toast.error("Ingrese cantidades vÃ¡lidas en litros para todos los tanques");
          setCargandoLectura(false);
          return;
        }
        await combustibleService.registrarLecturaInicial({
          tanque_id: tanqueId,
          cantidad_medida: parseFloat(cant),
          observaciones: "DeclaraciÃ³n inicial de inicio de turno/semana"
        });
      }
      toast.success("Inventario inicial declarado con Ã©xito. Bomba lista.");
      setTieneLecturaSemana(true);
      cargarDatosTanques();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error declarando inventario");
    } finally {
      setCargandoLectura(false);
    }
  };

  const handleBuscarPlaca = async (e) => {
    if (e) e.preventDefault();
    const placa = placaBusqueda.trim().toUpperCase();
    if (!placa) { toast.error("Ingrese una placa vÃ¡lida"); return; }
    
    setBuscandoVehiculo(true);
    setVehiculoEncontrado(null);
    setPlacaNoEncontrada(false);
    setSolicitudVinculada(null);
    setFotoKilometraje(null);
    setFotoKilometrajeUrl('');
    setFotoMaquina(null);
    setFotoMaquinaUrl('');
    setKilometraje('');
    setLitrosCargar('');
    
    try {
      const datos = await combustibleService.consultarVehiculo(placa);
      setVehiculoEncontrado(datos);
      if (datos.capacidad_tanque > 0) {
        setLitrosCargar(datos.capacidad_tanque); // sugerir tanque lleno
      }
      if (!datos.autorizado) {
        toast.error("VehÃ­culo NO autorizado permanentemente para combustible.");
      } else if (datos.cupo_entidad_excedido) {
        toast.error("Cupo de combustible semanal de la entidad agotado.");
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setPlacaNoEncontrada(true);
        toast.error("VehÃ­culo no registrado. Puede solicitar suministro especial.");
      } else {
        toast.error(err.response?.data?.detail || "Error al buscar vehÃ­culo");
      }
    } finally {
      setBuscandoVehiculo(false);
    }
  };

  // Activa la carga masiva usando una solicitud aprobada de la bandeja
  const handleCargarDesdeSolicitud = async (sol) => {
    setBuscandoVehiculo(true);
    setPlacaBusqueda(sol.placa);
    setVistaTab('surtir');
    
    try {
      const datos = await combustibleService.consultarVehiculo(sol.placa);
      setVehiculoEncontrado(datos);
      setSolicitudVinculada(sol);
      setLitrosCargar(sol.cantidad_solicitada);
      setFotoKilometraje(null);
      setFotoKilometrajeUrl('');
      setFotoMaquina(null);
      setFotoMaquinaUrl('');
      setKilometraje('');
      toast.success(`Cargando suministro especial para placa ${sol.placa}`);
    } catch (err) {
      toast.error("Error al obtener datos del vehÃ­culo");
    } finally {
      setBuscandoVehiculo(false);
    }
  };

  // Capturar foto desde cÃ¡mara nativa
  const handleFotoChange = async (e, tipo) => {
    const file = e.target.files[0];
    if (!file) return;

    if (tipo === 'kilometraje') {
      setSubiendoFotoK(true);
      setFotoKilometraje(file);
      // Simular subida y conversiÃ³n a URL local para previsualizar
      setFotoKilometrajeUrl(URL.createObjectURL(file));
      
      // Intentar OCR con IA en paralelo
      setIaLoadOdo(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          try {
            const { data } = await alcabalaService.extraerDatosIA(base64, 'odometro');
            if (data && data.kilometraje) {
              setKilometraje(data.kilometraje);
              toast.success(`Kilometraje detectado por IA: ${data.kilometraje} km`);
            } else {
              toast.error("No se pudo detectar el kilometraje por IA. EscrÃ­balo manual.");
            }
          } catch {
            toast.error("Fallo el OCR. Ingrese el kilometraje manualmente.");
          } finally {
            setIaLoadOdo(false);
          }
        };
        reader.readAsDataURL(file);
      } catch {
        setIaLoadOdo(false);
      } finally {
        setSubiendoFotoK(false);
      }
    } else {
      setSubiendoFotoM(true);
      setFotoMaquina(file);
      setFotoMaquinaUrl(URL.createObjectURL(file));
      setSubiendoFotoM(false);
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleRegistrarSuministro = async (e) => {
    e.preventDefault();
    if (!tanqueSeleccionado) { toast.error("Seleccione un tanque de suministro"); return; }
    if (!kilometraje || isNaN(kilometraje) || parseInt(kilometraje) <= 0) { toast.error("Ingrese un kilometraje numérico válido"); return; }
    if (!litrosCargar || isNaN(litrosCargar) || parseFloat(litrosCargar) <= 0) { toast.error("Ingrese litros válidos"); return; }
    if (!fotoKilometraje || !fotoMaquina) { toast.error("Debe capturar la foto del odómetro y del surtidor"); return; }

    setCargandoSuministro(true);
    try {
      const odoB64 = await fileToBase64(fotoKilometraje);
      const maqB64 = await fileToBase64(fotoMaquina);

      const payload = {
        placa: vehiculoEncontrado.placa,
        tanque_id: tanqueSeleccionado,
        kilometraje_actual: parseInt(kilometraje),
        cantidad_abastecida: parseFloat(litrosCargar),
        foto_kilometraje_url: odoB64,
        foto_maquina_url: maqB64,
        solicitud_aprobacion_id: solicitudVinculada ? solicitudVinculada.id : null,
        datos_ia_ocr: { kilometraje_ia: parseInt(kilometraje) }
      };

      const res = await combustibleService.registrarAbastecimiento(payload);
      toast.success(res.message || "Suministro registrado con éxito");
      
      // Limpiar estados
      setVehiculoEncontrado(null);
      setPlacaBusqueda('');
      setSolicitudVinculada(null);
      
      cargarDatosTanques();
      cargarBandejaSolicitudes();
      cargarHistorialBombero();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al registrar suministro");
    } finally {
      setCargandoSuministro(false);
    }
  };

  // Crear la solicitud de emergencia
  const handleCrearSolicitud = async (e) => {
    e.preventDefault();
    if (!formSolicitud.placa.trim()) { toast.error("La placa es obligatoria"); return; }
    if (!formSolicitud.cantidad_solicitada || isNaN(formSolicitud.cantidad_solicitada)) { toast.error("Ingrese los litros solicitados"); return; }
    if (!formSolicitud.motivo.trim()) { toast.error("Indique una justificaciÃ³n/motivo de emergencia"); return; }

    setEnviandoSolicitud(true);
    try {
      await combustibleService.registrarSolicitud({
        placa: formSolicitud.placa.toUpperCase(),
        cantidad_solicitada: parseFloat(formSolicitud.cantidad_solicitada),
        motivo: formSolicitud.motivo,
        nombre_conductor_manual: formSolicitud.nombre_conductor_manual || null,
        cedula_conductor_manual: formSolicitud.cedula_conductor_manual || null,
        marca_manual: formSolicitud.marca_manual || null,
        modelo_manual: formSolicitud.modelo_manual || null,
        color_manual: formSolicitud.color_manual || null
      });
      
      toast.success("Solicitud de combustible enviada al comando");
      setModalSolicitud(false);
      // Reset form
      setFormSolicitud({
        placa: '',
        cantidad_solicitada: '',
        motivo: '',
        nombre_conductor_manual: '',
        cedula_conductor_manual: '',
        marca_manual: '',
        modelo_manual: '',
        color_manual: ''
      });
      cargarBandejaSolicitudes();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo crear la solicitud");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Pantalla de DeclaraciÃ³n Inicial de Inventario obligatoria
  if (!tieneLecturaSemana && !cargandoTanques) {
    return (
      <div className="min-h-screen dark bg-bg-app flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-bg-card rounded-2xl border border-warning/30 shadow-tactica overflow-hidden">
          <div className="bg-warning/10 border-b border-warning/20 px-6 py-4 flex items-center gap-3">
            <AlertTriangle className="text-warning animate-pulse-slow" size={24} />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-warning">Apertura de Ciclo Semanal</h2>
              <p className="text-[10px] text-text-sec">Es obligatorio registrar la mediciÃ³n inicial de los tanques.</p>
            </div>
          </div>
          <form onSubmit={handleDeclararInventario} className="p-6 space-y-4">
            {tanques.map(t => (
              <div key={t.id} className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted flex justify-between">
                  <span>{t.nombre} {t.tipo_combustible ? `(${t.tipo_combustible.toUpperCase()})` : ''}</span>
                  <span className="text-text-sec">MÃX: {t.capacidad_maxima} L</span>
                </label>
                <div className="flex items-center bg-bg-low border border-white/10 rounded-xl overflow-hidden focus-within:border-warning/50 transition-all">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    required
                    value={lecturasForm[t.id] || ''}
                    onChange={e => setLecturasForm({ ...lecturasForm, [t.id]: e.target.value })}
                    className="flex-1 bg-transparent px-4 py-3 text-sm font-black text-text-main outline-none"
                  />
                  <span className="px-3 text-xs text-text-muted border-l border-white/10 bg-white/5 py-3">LITROS</span>
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={cargandoLectura}
              className="w-full h-12 rounded-xl bg-warning text-black text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-warning/90 transition-all"
            >
              {cargandoLectura ? <RefreshCw size={15} className="animate-spin" /> : <Power size={15} />}
              Confirmar DeclaraciÃ³n e Iniciar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark bg-bg-app flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.3em] text-success leading-none">SISTEMA DE COMBUSTIBLE</h1>
            <p className="text-[9px] text-text-muted font-bold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              Surtidor Base BAGFM
            </p>
          </div>
          <button 
            onClick={cargarDatosTanques}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <RefreshCw size={14} className="text-text-muted" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-lg mx-auto w-full px-4 pt-4">
        <div className="flex gap-1 bg-bg-low rounded-2xl p-1 border border-white/5">
          <button
            onClick={() => setVistaTab('surtir')}
            className={cn(
              'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
              vistaTab === 'surtir' ? 'bg-bg-card text-success border border-success/20' : 'text-text-muted hover:text-text-main'
            )}
          >
            <Flame size={14} /> Surtir
          </button>
          <button
            onClick={() => { setVistaTab('bandeja'); cargarBandejaSolicitudes(); }}
            className={cn(
              'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all relative',
              vistaTab === 'bandeja' ? 'bg-bg-card text-success border border-success/20' : 'text-text-muted hover:text-text-main'
            )}
          >
            <Clock size={14} /> Solicitudes
            {solicitudesAprobadas.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-success rounded-full animate-ping" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">
        {/* Nivel de Tanques - Siempre visible en Surtir */}
        {vistaTab === 'surtir' && (
          <div className="grid grid-cols-2 gap-3">
            {cargandoTanques ? (
              <div className="col-span-2 py-4 flex justify-center"><RefreshCw size={20} className="animate-spin text-text-muted" /></div>
            ) : (
              tanques.map(t => (
                <div key={t.id} className="bg-bg-card rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">{t.nombre}</span>
                    <span className="text-[10px] font-black font-display" style={{ color: t.porcentaje < 20 ? 'var(--danger)' : (t.porcentaje < 50 ? 'var(--warning)' : 'var(--success)') }}>
                      {t.porcentaje.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-md font-bold font-display text-text-main leading-none">{t.cantidad_actual.toFixed(0)} L</p>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${t.porcentaje}%`,
                          backgroundColor: t.porcentaje < 20 ? 'var(--danger)' : (t.porcentaje < 50 ? 'var(--warning)' : 'var(--success)') 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- TAB SURTIR --- */}
        {vistaTab === 'surtir' && (
          <div className="space-y-4">
            {/* Buscador de placa */}
            {!vehiculoEncontrado && (
              <form onSubmit={handleBuscarPlaca} className="bg-bg-card rounded-2xl border border-white/5 p-4 space-y-3">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Ingrese placa del vehÃ­culo</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="AB123CD"
                    value={placaBusqueda}
                    onChange={e => setPlacaBusqueda(e.target.value.toUpperCase())}
                    className="flex-1 min-w-0 bg-bg-low border border-white/10 rounded-xl px-4 py-3 text-2xl font-black text-text-main uppercase tracking-widest focus:border-success/50 outline-none transition-all text-center"
                  />
                  <button
                    type="submit"
                    disabled={buscandoVehiculo || !placaBusqueda.trim()}
                    className="w-14 h-14 shrink-0 bg-success/10 border border-success/30 rounded-xl flex items-center justify-center text-success hover:bg-success/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {buscandoVehiculo ? <RefreshCw size={20} className="animate-spin" /> : <Car size={20} />}
                  </button>
                </div>
                
                {/* BotÃ³n de solicitud directa para no registrados / emergencia */}
                {placaNoEncontrada && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormSolicitud({ ...formSolicitud, placa: placaBusqueda.toUpperCase() });
                      setModalSolicitud(true);
                    }}
                    className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-text-sec text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle size={13} /> Suministro Especial / Emergencia
                  </button>
                )}
              </form>
            )}

            {/* Historial Bombero (Solo si no hay vehiculo buscado) */}
            {!vehiculoEncontrado && historialBombero.length > 0 && (
              <div className="bg-bg-card rounded-2xl border border-white/5 p-4 space-y-3">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5"><ClipboardList size={12}/> Ãšltimos Abastecimientos</p>
                <div className="space-y-2">
                  {historialBombero.map((a, i) => (
                    <div key={a.id || i} className="bg-bg-low border border-white/5 rounded-xl p-3 flex justify-between items-center opacity-80 hover:opacity-100 transition-all">
                      <div>
                        <p className="text-sm font-black text-text-main font-display tracking-wide">{a.placa}</p>
                        <p className="text-[9px] text-text-muted mt-0.5">{a.entidad} Â· {a.marca} {a.modelo}</p>
                      </div>
                      <span className="text-[12px] font-black font-display text-emerald-400">
                        {Number(a.litros).toFixed(1)} L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ficha de VehÃ­culo y Formulario de Carga */}
            {vehiculoEncontrado && (
              <div className="bg-bg-card rounded-2xl border border-white/5 p-4 space-y-4 animate-in fade-in duration-300">
                {/* Datos del vehÃ­culo */}
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center border border-success/20 shrink-0">
                    <Car size={20} className="text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-lg font-black text-text-main tracking-wider">{vehiculoEncontrado.placa}</p>
                      <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-widest",
                        vehiculoEncontrado.autorizado && !vehiculoEncontrado.cupo_entidad_excedido
                          ? "bg-success/10 border-success/30 text-success"
                          : "bg-danger/10 border-danger/30 text-danger"
                      )}>
                        {vehiculoEncontrado.autorizado && !vehiculoEncontrado.cupo_entidad_excedido ? 'AUTORIZADO' : 'BLOQUEADO'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">
                      {vehiculoEncontrado.color} Â· {vehiculoEncontrado.marca} Â· {vehiculoEncontrado.modelo} {vehiculoEncontrado.tipo_combustible ? `(${vehiculoEncontrado.tipo_combustible.toUpperCase()})` : ''}
                    </p>
                  </div>
                </div>

                {/* Mostrar estado de la entidad si existe */}
                {vehiculoEncontrado.entidad_nombre && (
                  <div className="p-3 rounded-xl bg-bg-low/30 border border-white/5 text-[10px] space-y-1.5">
                    <div className="flex justify-between font-black text-text-sec uppercase tracking-widest">
                      <span>ENTIDAD: {vehiculoEncontrado.entidad_nombre}</span>
                      <span className={vehiculoEncontrado.cupo_entidad_excedido ? "text-danger" : "text-text-muted"}>
                        {vehiculoEncontrado.consumo_semanal_entidad.toFixed(0)} / {vehiculoEncontrado.limite_semanal_entidad.toFixed(0)} L
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-success"
                        style={{ width: `${Math.min((vehiculoEncontrado.consumo_semanal_entidad / (vehiculoEncontrado.limite_semanal_entidad || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Si no estÃ¡ autorizado o cupo excedido, y NO hay solicitud de bypass */}
                {(!vehiculoEncontrado.autorizado || vehiculoEncontrado.cupo_entidad_excedido) && !solicitudVinculada ? (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-center space-y-3">
                    <ShieldAlert size={28} className="text-danger mx-auto animate-pulse-slow" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-danger">Acceso Denegado a Combustible</h4>
                      <p className="text-[9px] text-text-sec mt-1">Este vehÃ­culo o su entidad no tienen cupo o autorizaciÃ³n activa en el sistema.</p>
                    </div>
                    <button
                      onClick={() => {
                        setFormSolicitud({
                          ...formSolicitud,
                          placa: vehiculoEncontrado.placa,
                          cantidad_solicitada: vehiculoEncontrado.capacidad_tanque || 30
                        });
                        setModalSolicitud(true);
                      }}
                      className="w-full h-10 rounded-xl bg-danger text-white text-[10px] font-black uppercase tracking-widest hover:bg-danger-deep transition-all"
                    >
                      Solicitar AprobaciÃ³n de Emergencia
                    </button>
                  </div>
                ) : (
                  // FORMULARIO DE ABASTECIMIENTO ACTIVO (AUTORIZADO O BYPASS APROBADO)
                  <form onSubmit={handleRegistrarSuministro} className="space-y-4">
                    {solicitudVinculada && (
                      <div className="p-3 bg-success/15 border border-success/30 rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-success shrink-0" />
                        <span className="text-[9px] font-black text-success uppercase tracking-widest">
                          Bypass Aprobado: {solicitudVinculada.cantidad_solicitada} Litros MÃ¡x.
                        </span>
                      </div>
                    )}

                    {/* Selector de tanque */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Tanque Surtidor</label>
                      <select 
                        value={tanqueSeleccionado}
                        onChange={e => setTanqueSeleccionado(e.target.value)}
                        className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-text-main outline-none focus:border-success/50"
                      >
                        {tanques.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre} {t.tipo_combustible ? `- ${t.tipo_combustible.toUpperCase()}` : ''} ({t.cantidad_actual.toFixed(0)} L disp.)</option>
                        ))}
                      </select>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Litros a Surtir</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={litrosCargar}
                          onChange={e => setLitrosCargar(e.target.value)}
                          max={solicitudVinculada ? solicitudVinculada.cantidad_solicitada : (vehiculoEncontrado.capacidad_tanque || undefined)}
                          className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2.5 text-sm font-black text-text-main outline-none focus:border-success/50"
                          placeholder="0.0"
                        />
                        <span className="text-[8px] text-text-muted">Cap. Tanque: {vehiculoEncontrado.capacidad_tanque} L</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Kilometraje Actual</label>
                        <input
                          type="number"
                          required
                          value={kilometraje}
                          onChange={e => setKilometraje(e.target.value)}
                          className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2.5 text-sm font-black text-text-main outline-none focus:border-success/50"
                          placeholder={`${vehiculoEncontrado.ultimo_kilometraje} km`}
                        />
                        <span className="text-[8px] text-text-muted">Ãšltimo: {vehiculoEncontrado.ultimo_kilometraje} km</span>
                      </div>
                    </div>

                    {/* Fotos obligatorias de cÃ¡mara */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Foto OdÃ³metro */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Foto OdÃ³metro</span>
                        <button
                          type="button"
                          onClick={() => fileOdoRef.current.click()}
                          disabled={iaLoadOdo}
                          className={cn(
                            "w-full aspect-[1.5/1] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden",
                            fotoKilometrajeUrl ? "border-success/40 bg-success/5" : "border-white/10 hover:border-white/20 bg-bg-low/10"
                          )}
                        >
                          {fotoKilometrajeUrl ? (
                            <>
                              <img src={fotoKilometrajeUrl} alt="Odometro" className="absolute inset-0 w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Camera size={18} className="text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera size={20} className="text-text-muted" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">CÃ¡mara</span>
                            </>
                          )}
                        </button>
                        <input 
                          type="file" 
                          ref={fileOdoRef} 
                          accept="image/*" 
                          capture="environment" 
                          onChange={(e) => handleFotoChange(e, 'kilometraje')}
                          className="hidden" 
                        />
                        {iaLoadOdo && <p className="text-[8px] text-success animate-pulse font-bold uppercase tracking-wider text-center mt-1">Leyendo con IA...</p>}
                      </div>

                      {/* Foto MÃ¡quina */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Foto Dispensador</span>
                        <button
                          type="button"
                          onClick={() => fileMaquinaRef.current.click()}
                          className={cn(
                            "w-full aspect-[1.5/1] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden",
                            fotoMaquinaUrl ? "border-success/40 bg-success/5" : "border-white/10 hover:border-white/20 bg-bg-low/10"
                          )}
                        >
                          {fotoMaquinaUrl ? (
                            <>
                              <img src={fotoMaquinaUrl} alt="Dispensador" className="absolute inset-0 w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Camera size={18} className="text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera size={20} className="text-text-muted" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">CÃ¡mara</span>
                            </>
                          )}
                        </button>
                        <input 
                          type="file" 
                          ref={fileMaquinaRef} 
                          accept="image/*" 
                          capture="environment" 
                          onChange={(e) => handleFotoChange(e, 'maquina')}
                          className="hidden" 
                        />
                      </div>
                    </div>

                    {/* BotÃ³n de envÃ­o */}
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVehiculoEncontrado(null);
                          setPlacaBusqueda('');
                          setSolicitudVinculada(null);
                        }}
                        className="w-1/3 h-12 bg-white/5 border border-white/10 rounded-xl text-text-muted text-[10px] font-black uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={cargandoSuministro || subiendoFotoK || subiendoFotoM || iaLoadOdo || !fotoKilometraje || !fotoMaquina}
                        className="flex-1 h-12 rounded-xl bg-success text-bg-app font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {cargandoSuministro ? <RefreshCw size={15} className="animate-spin" /> : <Flame size={15} />}
                        Completar Suministro
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB BANDEJA DE SOLICITUDES --- */}
        {vistaTab === 'bandeja' && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-text-muted">Bandeja de Aprobaciones Remotas</h2>

            {cargandoBandeja ? (
              <div className="py-8 flex justify-center"><RefreshCw size={24} className="animate-spin text-success" /></div>
            ) : (
              <div className="space-y-4">
                {/* APROBADAS LISTAS PARA CARGAR */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-success flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Aprobadas para Surtir ({solicitudesAprobadas.length})
                  </h3>
                  {solicitudesAprobadas.length === 0 ? (
                    <p className="text-[10px] text-text-muted italic py-3 bg-bg-card rounded-xl border border-white/5 text-center">No hay Ã³rdenes aprobadas listas para carga.</p>
                  ) : (
                    solicitudesAprobadas.map(sol => (
                      <div 
                        key={sol.id} 
                        onClick={() => handleCargarDesdeSolicitud(sol)}
                        className="bg-bg-card border border-success/30 rounded-xl p-3 flex justify-between items-center hover:bg-success/5 transition-all cursor-pointer active:scale-98"
                        style={{ backgroundColor: 'var(--bg-card)' }}
                      >
                        <div>
                          <p className="text-sm font-black text-text-main font-display tracking-wide">{sol.placa}</p>
                          <p className="text-[9px] text-text-muted mt-0.5">Suministro Ãºnico autorizado: {sol.cantidad_solicitada} Litros</p>
                          {sol.conductor && <p className="text-[8px] text-success/80 mt-1 uppercase font-bold">Conductor: {sol.conductor}</p>}
                        </div>
                        <button 
                          onClick={() => handleCargarDesdeSolicitud(sol)}
                          className="h-8 px-4 rounded-lg bg-success text-bg-app font-black text-[9px] uppercase tracking-widest"
                        >
                          Cargar
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* EN ESPERA DE COMANDANTE */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-warning flex items-center gap-1.5">
                    <Clock size={13} /> En Espera del Comando ({solicitudesEspera.length})
                  </h3>
                  {solicitudesEspera.length === 0 ? (
                    <p className="text-[10px] text-text-muted italic py-3 bg-bg-card rounded-xl border border-white/5 text-center">No hay solicitudes pendientes en curso.</p>
                  ) : (
                    solicitudesEspera.map(sol => (
                      <div key={sol.id} className="bg-bg-card border border-white/5 rounded-xl p-3 flex justify-between items-center opacity-80">
                        <div>
                          <p className="text-sm font-black text-text-main font-display tracking-wide">{sol.placa}</p>
                          <p className="text-[9px] text-text-muted mt-0.5">Litros pedidos: {sol.cantidad_solicitada} L {sol.tipo_solicitud ? `Â· ${sol.tipo_solicitud.replace(/_/g, ' ').toUpperCase()}` : ''}</p>
                          <p className="text-[8px] text-text-sec italic mt-1">Motivo: "{sol.motivo}"</p>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded">
                          PENDIENTE
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL NUEVA SOLICITUD DE EMERGENCIA */}
      {modalSolicitud && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-bg-low/50">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-danger" />
                <p className="text-[10px] font-black uppercase tracking-wider text-text-main">Solicitud de Suministro Especial</p>
              </div>
              <button 
                onClick={() => setModalSolicitud(false)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"
              >
                <XCircle size={15} className="text-text-muted" />
              </button>
            </div>

            <form onSubmit={handleCrearSolicitud} className="overflow-y-auto flex-1 p-4 space-y-3 scrollbar-tactical">
              {/* Placa y cantidad */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Placa *</label>
                  <input
                    type="text"
                    required
                    value={formSolicitud.placa}
                    onChange={e => setFormSolicitud({ ...formSolicitud, placa: e.target.value.toUpperCase() })}
                    className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-text-main uppercase outline-none focus:border-danger/40"
                    placeholder="AB123CD"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Litros *</label>
                  <input
                    type="number"
                    required
                    value={formSolicitud.cantidad_solicitada}
                    onChange={e => setFormSolicitud({ ...formSolicitud, cantidad_solicitada: e.target.value })}
                    className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-text-main outline-none focus:border-danger/40"
                    placeholder="30"
                  />
                </div>
              </div>

              {/* Datos del conductor */}
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Conductor (Nombre y Apellido)</label>
                <input
                  type="text"
                  value={formSolicitud.nombre_conductor_manual}
                  onChange={e => setFormSolicitud({ ...formSolicitud, nombre_conductor_manual: e.target.value.toUpperCase() })}
                  className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-text-main outline-none focus:border-danger/40"
                  placeholder="NOMBRE DEL OFICIAL"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">CÃ©dula del Conductor</label>
                <input
                  type="text"
                  value={formSolicitud.cedula_conductor_manual}
                  onChange={e => setFormSolicitud({ ...formSolicitud, cedula_conductor_manual: e.target.value.toUpperCase() })}
                  className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-text-main outline-none focus:border-danger/40"
                  placeholder="V-00000000"
                />
              </div>

              {/* Marca, Modelo y Color */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Marca</label>
                  <input
                    type="text"
                    value={formSolicitud.marca_manual}
                    onChange={e => setFormSolicitud({ ...formSolicitud, marca_manual: e.target.value.toUpperCase() })}
                    className="w-full bg-bg-low border border-white/10 rounded-lg px-2 py-2 text-[10px] font-black text-text-main outline-none focus:border-danger/40"
                    placeholder="TOYOTA"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Modelo</label>
                  <input
                    type="text"
                    value={formSolicitud.modelo_manual}
                    onChange={e => setFormSolicitud({ ...formSolicitud, modelo_manual: e.target.value.toUpperCase() })}
                    className="w-full bg-bg-low border border-white/10 rounded-lg px-2 py-2 text-[10px] font-black text-text-main outline-none focus:border-danger/40"
                    placeholder="HILUX"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Color</label>
                  <input
                    type="text"
                    value={formSolicitud.color_manual}
                    onChange={e => setFormSolicitud({ ...formSolicitud, color_manual: e.target.value.toUpperCase() })}
                    className="w-full bg-bg-low border border-white/10 rounded-lg px-2 py-2 text-[10px] font-black text-text-main outline-none focus:border-danger/40"
                    placeholder="BLANCO"
                  />
                </div>
              </div>

              {/* JustificaciÃ³n */}
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">JustificaciÃ³n y Entidad procedencia *</label>
                <textarea
                  required
                  rows={3}
                  value={formSolicitud.motivo}
                  onChange={e => setFormSolicitud({ ...formSolicitud, motivo: e.target.value })}
                  className="w-full bg-bg-low border border-white/10 rounded-lg px-3 py-2 text-xs font-semibold text-text-main outline-none focus:border-danger/40 resize-none"
                  placeholder="Ej: VehÃ­culo de Comandancia de otra base militar en trÃ¡nsito. Requiere 30 L de gasolina."
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalSolicitud(false)}
                  className="w-1/3 h-11 bg-white/5 border border-white/10 rounded-xl text-text-muted text-[10px] font-black uppercase tracking-widest"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={enviandoSolicitud}
                  className="flex-1 h-11 bg-danger text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {enviandoSolicitud ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

