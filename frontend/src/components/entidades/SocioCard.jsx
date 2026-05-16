import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  User as UserIcon, 
  Car as CarIcon, 
  RefreshCw, 
  Pause, 
  Play, 
  ShieldCheck, 
  ChevronDown,
  Clock,
  ShieldAlert,
  Calendar,
  Trash2,
  Edit2,
  Share2
} from 'lucide-react';
import { QRCode } from 'react-qr-code';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

export const SocioCard = ({ socio, onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const qrRef = useRef(null);

  const tieneVehiculos = socio.vehiculos && socio.vehiculos.length > 0;
  const m = socio.membresia;
  const progreso = m?.progreso;
  
  const esActivo = m?.estado === 'activa';
  const esExonerado = m?.estado === 'exonerada';
  const esSuspendido = m?.estado === 'suspendida';
  const esVencido = progreso?.vencida || m?.estado === 'vencida';

  // Lógica de progreso visual basada en 30 días
  const diasRestantes = progreso?.dias_restantes || 0;
  const visualProgress = Math.max(0, Math.min(100, ((30 - diasRestantes) / 30) * 100));

  // Determinar color y mensaje de estado
  let statusColor = 'text-text-muted';
  let statusLabel = 'SIN ACCESO';
  let badgeVariant = 'sin-membresia';

  if (esExonerado) {
    statusColor = 'text-primary';
    statusLabel = 'EXONERADO';
    badgeVariant = 'activa';
  } else if (esActivo && !esVencido) {
    statusColor = 'text-primary';
    statusLabel = 'ACTIVO';
    badgeVariant = 'activa';
  } else if (esSuspendido) {
    statusColor = 'text-danger';
    statusLabel = 'SUSPENDIDO';
    badgeVariant = 'suspendida';
  } else if (esVencido) {
    statusColor = 'text-amber-500';
    statusLabel = 'VENCIDO';
    badgeVariant = 'pendiente';
  }

  const handleShare = async (e) => {
    e.stopPropagation();
    if (!qrRef.current) return;

    try {
      setCompartiendo(true);
      // Generar QR en imagen (apunta al portal de acceso)
      const dataUrl = await toPng(qrRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 4,
        style: { borderRadius: '0px' }
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `ACCESO_BAGFM_${socio.cedula}.png`, { type: 'image/png' });

      const portalUrl = `${window.location.origin}/acceso`;
      const shareText = `🏛️ SISTEMA TÁCTICO BAGFM\n\n` +
                        `👤 MIEMBRO: ${socio.nombre_completo}\n` +
                        `🆔 CÉDULA: ${socio.cedula}\n\n` +
                        `🔗 ENLACE AL PORTAL DE ACCESO:\n${portalUrl}\n\n` +
                        `📍 UBICACIÓN: Base Aérea Generalísimo Francisco de Miranda (La Carlota)\n\n` +
                        `Inicie sesión en el portal con su cédula para visualizar y descargar su Pase QR Oficial. La imagen adjunta le llevará directamente al portal.`;

      if (navigator.share) {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Acceso BAGFM - ${socio.nombre_completo}`,
            text: shareText,
            files: [file]
          });
        } else {
          await navigator.share({
            title: `Acceso BAGFM - ${socio.nombre_completo}`,
            text: shareText
          });
        }
      } else {
        // Fallback al portapapeles si Web Share no está disponible
        navigator.clipboard.writeText(shareText);
        alert("Enlace e instrucciones copiados al portapapeles. Tu navegador no soporta envío nativo de archivos.");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Error al compartir", err);
      }
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <Card elevation={1} className={`group relative overflow-hidden border-white/5 transition-all duration-300 hover:border-white/10 ${isOpen ? 'ring-1 ring-primary/20 bg-bg-high/5' : ''}`}>
      {/* Contenedor Oculto para Generar QR de Compartir */}
      <div className="absolute -left-[9999px] -top-[9999px]">
        <div ref={qrRef} className="p-4 bg-white" style={{ width: 256, height: 256 }}>
            <QRCode 
                value={`${window.location.origin}/acceso`} 
                size={224} 
                bgColor="#ffffff" 
                fgColor="#000000" 
            />
        </div>
      </div>
      {/* Indicador de estado lateral */}
      <div className={`absolute top-0 left-0 w-1 h-full ${statusColor.replace('text-', 'bg-')}`} />
      
      {/* HEADER: Info + Acciones + Badge + Chevron */}
      <div 
        className="p-3 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Nivel Superior: Avatar + Info + (Badge/Chevron en móvil) */}
        <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0 transition-colors group-hover:border-primary/30 ${statusColor}`}>
              <UserIcon size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-text-main leading-none mb-1 flex items-center gap-2 truncate">
                {socio.nombre_completo}
                {esExonerado && <ShieldCheck size={13} className="text-primary shrink-0" />}
              </h4>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest truncate">
                {socio.cedula}
              </p>
            </div>
          </div>

          {/* Badge y Chevron (Solo visibles aquí en móvil) */}
          <div className="flex items-center gap-2 sm:hidden shrink-0">
            <Badge variant={badgeVariant} className="text-[9px] px-2 py-0.5">
              {statusLabel}
            </Badge>
            <ChevronDown size={15} className={`text-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Nivel de Acciones: Botones + Badge (Desktop) + Chevron (Desktop) */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
          {/* Botones de acción principales */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={(e) => { e.stopPropagation(); onAction('renovacion', socio); }}
              className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 flex items-center justify-center transition-all hover:scale-105 shrink-0"
              title="Renovar membresía"
            >
              <RefreshCw size={14} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('estado', { socio, nuevoEstado: esSuspendido ? 'activa' : 'suspendida' }); }}
              className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all hover:scale-105 shrink-0 ${
                esSuspendido 
                  ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20' 
                  : 'bg-danger/10 border-danger/20 text-danger hover:bg-danger/20'
              }`}
              title={esSuspendido ? 'Activar' : 'Suspender'}
            >
              {esSuspendido ? <Play size={14} /> : <Pause size={14} />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('estado', { socio, nuevoEstado: esExonerado ? 'activa' : 'exonerada' }); }}
              className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all hover:scale-105 shrink-0 ${
                esExonerado 
                  ? 'bg-primary/20 border-primary/30 text-primary' 
                  : 'bg-white/5 border-white/10 text-text-muted hover:text-primary hover:border-primary/20'
              }`}
              title={esExonerado ? 'Quitar exoneración' : 'Exonerar'}
            >
              <ShieldAlert size={14} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('editar', socio); }}
              className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-primary hover:border-primary/20 flex items-center justify-center transition-all hover:scale-105 shrink-0"
              title="Editar socio"
            >
              <Edit2 size={13} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('eliminar', socio); }}
              className="h-8 w-8 rounded-lg border border-white/5 bg-white/5 text-text-muted/40 hover:bg-danger/10 hover:border-danger/20 hover:text-danger flex items-center justify-center transition-all hover:scale-105 shrink-0"
              title="Eliminar socio"
            >
              <Trash2 size={13} />
            </button>

            <button
              onClick={handleShare}
              disabled={compartiendo}
              className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 flex items-center justify-center transition-all hover:scale-105 shrink-0"
              title="Compartir accesos"
            >
              {compartiendo ? <RefreshCw size={13} className="animate-spin" /> : <Share2 size={13} />}
            </button>
          </div>

          {/* Separador y Badge/Chevron (Solo Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1.5">
            <div className="w-px h-6 bg-white/5 mx-1" />
            <Badge variant={badgeVariant}>
              {statusLabel}
            </Badge>
            <ChevronDown size={15} className={`text-text-muted transition-transform duration-300 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Barra de Progreso con fecha de vencimiento encima */}
      {m && !esExonerado && progreso && (
        <div className="mt-3 px-1">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5">
              <Calendar size={10} className="text-text-muted/40" />
              <span className="text-[8px] uppercase font-bold tracking-widest text-text-muted/60">
                Vence: {m?.fecha_fin ? new Date(m.fecha_fin).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'N/A'}
              </span>
            </div>
            <span className={`text-[9px] font-mono font-bold ${progreso.porcentaje > 80 ? 'text-danger' : 'text-text-muted/60'}`}>
              {progreso.dias_restantes}d
            </span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                progreso.porcentaje > 90 ? 'bg-danger' : 
                progreso.porcentaje > 70 ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${visualProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* SECCIÓN DESPLEGABLE: Solo vehículos */}
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-3 pt-2 border-t border-white/5">
          {esExonerado && (
            <div className="mb-2 px-2 py-1.5 bg-primary/5 rounded-lg border border-primary/10 flex items-center gap-2">
              <ShieldCheck size={13} className="text-primary" />
              <p className="text-[9px] font-bold text-primary/80 uppercase tracking-widest">Acceso Permanente</p>
            </div>
          )}

          {/* Vehículos vinculados */}
          <div className="flex items-center gap-1.5 mb-2">
            <CarIcon size={12} className="text-primary/60" />
            <span className="text-[9px] uppercase font-black text-text-muted/50 tracking-widest">Vehículos</span>
            {tieneVehiculos && (
              <span className="text-[8px] font-black text-primary/40 bg-primary/5 px-1.5 py-0.5 rounded">{socio.vehiculos.length}</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {tieneVehiculos ? (
              socio.vehiculos.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-black text-primary font-mono tracking-wider">{v.placa}</span>
                    <span className="text-[9px] font-bold text-text-main/60 uppercase truncate">{v.marca} {v.modelo}</span>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-text-muted/40 uppercase shrink-0 ml-2">{v.color || '—'}</span>
                </div>
              ))
            ) : (
              <p className="text-[9px] font-black text-danger/30 uppercase tracking-widest italic col-span-full py-2">Sin vehículos registrados</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
