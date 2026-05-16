import React from 'react';
import { QRCode } from 'react-qr-code';
import { cn } from '../../lib/utils';
import { Shield, QrCode, MapPin, Calendar, User, Car, Tag, ParkingSquare } from 'lucide-react';

/**
 * PlantillaPreview — renderiza la vista previa visual de un carnet/pase.
 * Soporta 4 plantillas: colgante, cartera, ticket, credencial.
 * Diseñado para impresión directa (CSS @media print).
 */

const QRPlaceholder = ({ size = 80, className }) => (
    <div className={cn("flex items-center justify-center bg-white rounded-lg", className)}
        style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size * 0.85} height={size * 0.85}>
            <rect x="5" y="5" width="30" height="30" rx="3" fill="#111" />
            <rect x="65" y="5" width="30" height="30" rx="3" fill="#111" />
            <rect x="5" y="65" width="30" height="30" rx="3" fill="#111" />
            <rect x="12" y="12" width="16" height="16" rx="2" fill="white" />
            <rect x="72" y="12" width="16" height="16" rx="2" fill="white" />
            <rect x="12" y="72" width="16" height="16" rx="2" fill="white" />
            <rect x="16" y="16" width="8" height="8" fill="#111" />
            <rect x="76" y="16" width="8" height="8" fill="#111" />
            <rect x="16" y="76" width="8" height="8" fill="#111" />
            <rect x="42" y="5" width="16" height="8" rx="1" fill="#333" />
            <rect x="42" y="20" width="8" height="8" rx="1" fill="#333" />
            <rect x="55" y="42" width="8" height="16" rx="1" fill="#333" />
            <rect x="42" y="50" width="8" height="8" rx="1" fill="#333" />
            <rect x="65" y="42" width="30" height="8" rx="1" fill="#333" />
            <rect x="42" y="65" width="16" height="8" rx="1" fill="#333" />
            <rect x="70" y="70" width="8" height="20" rx="1" fill="#333" />
            <rect x="82" y="65" width="8" height="8" rx="1" fill="#333" />
            <rect x="42" y="82" width="20" height="8" rx="1" fill="#333" />
        </svg>
    </div>
);

// ──── PLANTILLA: COLGANTE (vertical, para el cuello) ──────────────────────────

const PlantillaColgante = ({ datos, config }) => {
    const c = config.colores;
    return (
        <div className="w-[260px] mx-auto select-none" id="carnet-preview">

            <div className="rounded-2xl overflow-hidden shadow-2xl border"
                style={{ borderColor: `${c.primario}30`, background: c.fondo }}>

                {/* Header con banda de color */}
                <div className="px-5 py-4 text-center relative" style={{ background: c.primario }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full -mr-6 -mt-6 opacity-10 bg-white" />
                    <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-1" style={{ color: `${c.textoHeader}99` }}>
                        {config.subtitulo || 'BASE AÉREA GENERALISIMO FRANCISCO DE MIRANDA'}
                    </p>
                    <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: c.textoHeader }}>
                        {config.titulo || 'BAGFM ACCESS'}
                    </h2>
                </div>

                {/* Datos — Reajustado por eliminación de foto */}
                <div className="px-5 pt-6 pb-4 text-center space-y-3">
                    <div>
                        <p className="text-sm font-black uppercase tracking-tight" style={{ color: c.textoNombre }}>
                            {datos.nombre || 'NOMBRE APELLIDO'}
                        </p>
                        {datos.cedula && (
                            <p className="text-[9px] font-bold tracking-wider mt-0.5" style={{ color: `${c.textoNombre}80` }}>
                                {datos.cedula}
                            </p>
                        )}
                    </div>

                    {/* Badge de tipo */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest"
                        style={{ background: `${c.primario}15`, color: c.primario, border: `1px solid ${c.primario}30` }}>
                        <Tag size={9} />
                        {datos.tipo_acceso || 'INVITADO'}
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-1 pt-2">
                        {datos.entidad && (
                            <div className="text-left">
                                <p className="text-[7px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}50` }}>Entidad</p>
                                <p className="text-[9px] font-black uppercase" style={{ color: c.textoNombre }}>{datos.entidad}</p>
                            </div>
                        )}
                        {datos.evento && (
                            <div className="text-right">
                                <p className="text-[7px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}50` }}>Evento</p>
                                <p className="text-[9px] font-black uppercase" style={{ color: c.textoNombre }}>{datos.evento}</p>
                            </div>
                        )}
                    </div>

                    {datos.vehiculo_placa && (
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                            <Car size={10} style={{ color: `${c.textoNombre}60` }} />
                            <span className="text-[9px] font-bold tracking-widest" style={{ color: `${c.textoNombre}80` }}>
                                {datos.vehiculo_placa}
                            </span>
                        </div>
                    )}

                    {datos.zona_nombre && (
                        <div className="flex items-center justify-center gap-1.5">
                            <ParkingSquare size={10} style={{ color: c.primario }} />
                            <span className="text-[9px] font-bold tracking-wider" style={{ color: c.primario }}>
                                {datos.zona_nombre} {datos.puesto_codigo && `· ${datos.puesto_codigo}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* QR — Maximizado para escaneo táctico */}
                <div className="flex flex-col items-center pb-2 pt-2">
                    {datos.qr ? (
                        <div className="bg-white rounded-lg p-1.5 flex items-center justify-center shrink-0" style={{ width: 140, height: 140 }}>
                            <QRCode value={datos.qr} size={128} level="M" />
                        </div>
                    ) : (
                        <QRPlaceholder size={140} />
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-2 text-center" style={{ background: `${c.primario}10` }}>
                    <div className="flex items-center justify-center gap-1.5">
                        <Calendar size={8} style={{ color: `${c.textoNombre}50` }} />
                        <p className="text-[7px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}50` }}>
                            Válido: {datos.fecha_inicio || '--/--'} al {datos.fecha_fin || '--/--'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ──── PLANTILLA: CARTERA (horizontal, formato tarjeta) ────────────────────────

const PlantillaCartera = ({ datos, config }) => {
    const c = config.colores;
    return (
        <div className="w-[340px] mx-auto select-none" id="carnet-preview">
            <div className="rounded-2xl overflow-hidden shadow-2xl flex h-[200px]"
                style={{ background: c.fondo, border: `1px solid ${c.primario}25` }}>

                {/* Panel izquierdo color */}
                <div className="w-[110px] flex flex-col items-center justify-between py-4 px-2 shrink-0 relative"
                    style={{ background: c.primario }}>
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <div className="absolute top-4 -left-4 w-20 h-20 bg-white rounded-full" />
                        <div className="absolute bottom-4 -right-4 w-16 h-16 bg-white rounded-full" />
                    </div>
                    <div className="text-center relative z-10">
                        <Shield size={16} style={{ color: c.textoHeader }} className="mx-auto mb-1" />
                        <p className="text-[7px] font-black uppercase tracking-[0.3em]" style={{ color: c.textoHeader }}>
                            {config.titulo || 'BAGFM'}
                        </p>
                    </div>
                    <div className="w-14 h-14 rounded-xl border-2 flex items-center justify-center overflow-hidden relative z-10"
                        style={{ borderColor: `${c.textoHeader}50`, background: `${c.textoHeader}15` }}>
                        {datos.foto_url ? (
                            <img src={datos.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <User size={24} style={{ color: c.textoHeader }} />
                        )}
                    </div>
                    <p className="text-[7px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 relative z-10"
                        style={{ color: c.primario, background: c.textoHeader }}>
                        {datos.tipo_acceso || 'INVITADO'}
                    </p>
                </div>

                {/* Panel derecho data */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-tight leading-tight" style={{ color: c.textoNombre }}>
                            {datos.nombre || 'NOMBRE APELLIDO'}
                        </p>
                        {datos.cedula && (
                            <p className="text-[8px] font-bold tracking-wider mt-0.5" style={{ color: `${c.textoNombre}60` }}>
                                {datos.cedula}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {datos.entidad && (
                                <div>
                                    <p className="text-[6px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}40` }}>Entidad</p>
                                    <p className="text-[8px] font-black uppercase" style={{ color: c.textoNombre }}>{datos.entidad}</p>
                                </div>
                            )}
                            {datos.vehiculo_placa && (
                                <div>
                                    <p className="text-[6px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}40` }}>Vehículo</p>
                                    <p className="text-[8px] font-black uppercase" style={{ color: c.textoNombre }}>{datos.vehiculo_placa}</p>
                                </div>
                            )}
                            {datos.zona_nombre && (
                                <div>
                                    <p className="text-[6px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}40` }}>Zona</p>
                                    <p className="text-[8px] font-black uppercase" style={{ color: c.primario }}>{datos.zona_nombre}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[6px] font-bold uppercase tracking-widest" style={{ color: `${c.textoNombre}40` }}>Vigencia</p>
                            <p className="text-[8px] font-bold" style={{ color: `${c.textoNombre}70` }}>
                                {datos.fecha_inicio || '--/--'} — {datos.fecha_fin || '--/--'}
                            </p>
                        </div>
                        {datos.qr ? (
                            <div className="bg-white rounded-lg p-1 flex items-center justify-center shrink-0" style={{ width: 85, height: 85 }}>
                                <QRCode value={datos.qr} size={77} level="M" />
                            </div>
                        ) : (
                            <QRPlaceholder size={85} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ──── PLANTILLA: TICKET (compacto, estilo boleto) ─────────────────────────────

const PlantillaTicket = ({ datos, config }) => {
    const c = config.colores;
    return (
        <div className="w-[320px] mx-auto select-none" id="carnet-preview">
            <div className="rounded-2xl overflow-hidden shadow-2xl relative"
                style={{ background: c.fondo, border: `1px solid ${c.primario}20` }}>

                {/* Muescas tácticas (simulan recorte físico) */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white print:bg-white" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-white print:bg-white" />

                {/* Contenido */}
                <div className="flex items-stretch">
                    {/* QR lado izquierdo */}
                    <div className="p-4 flex flex-col items-center justify-center border-r border-dashed shrink-0"
                        style={{ borderColor: `${c.primario}20` }}>
                        {datos.qr ? (
                            <div className="bg-white rounded-lg p-1.5 flex items-center justify-center shrink-0" style={{ width: 115, height: 115 }}>
                                <QRCode value={datos.qr} size={103} level="M" />
                            </div>
                        ) : (
                            <QRPlaceholder size={115} />
                        )}
                    </div>

                    {/* Data */}
                    <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-[7px] font-black uppercase tracking-[0.3em]" style={{ color: c.primario }}>
                                    {config.titulo || 'BAGFM ACCESS'}
                                </p>
                                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full"
                                    style={{ background: `${c.primario}15`, color: c.primario }}>
                                    {datos.tipo_acceso || 'ENTRADA'}
                                </span>
                            </div>
                            <p className="text-sm font-black uppercase tracking-tight mt-2 leading-tight" style={{ color: c.textoNombre }}>
                                {datos.nombre || 'NOMBRE APELLIDO'}
                            </p>
                            {datos.evento && (
                                <p className="text-[8px] font-bold uppercase tracking-wider mt-1" style={{ color: `${c.textoNombre}60` }}>
                                    {datos.evento}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed"
                            style={{ borderColor: `${c.primario}15` }}>
                            {datos.vehiculo_placa && (
                                <span className="text-[8px] font-black flex items-center gap-1" style={{ color: `${c.textoNombre}70` }}>
                                    <Car size={9} /> {datos.vehiculo_placa}
                                </span>
                            )}
                            <span className="text-[7px] font-bold" style={{ color: `${c.textoNombre}50` }}>
                                {datos.fecha_fin || '--/--'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ──── PLANTILLA: CREDENCIAL (formal, vertical tipo credencial laboral) ────────

const PlantillaCredencial = ({ datos, config }) => {
    const c = config.colores;
    return (
        <div className="w-[240px] mx-auto select-none overflow-hidden" id="carnet-preview" style={{ width: '240px', minWidth: '240px' }}>
            <div className="rounded-2xl overflow-hidden shadow-2xl relative"
                style={{ background: c.fondo, border: `2px solid ${c.primario}30`, minHeight: '380px', display: 'flex', flexDirection: 'column' }}>

                {/* Banner superior (fijo) */}
                <div className="h-4 w-full shrink-0" style={{ background: c.primario }} />

                <div className="p-5 flex-1 flex flex-col justify-between">
                    {/* Logo + título */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${c.primario}15` }}>
                            <Shield size={16} style={{ color: c.primario }} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] truncate" style={{ color: c.primario }}>
                                {config.titulo || 'BAGFM'}
                            </p>
                            <p className="text-[6px] font-bold uppercase tracking-widest truncate" style={{ color: `${c.textoNombre}50` }}>
                                {config.subtitulo || 'CONTROL DE ACCESO'}
                            </p>
                        </div>
                    </div>

                    {/* Nombre y Tipo — Espaciado armonizado */}
                    <div className="text-center py-4 space-y-2">
                        <div>
                            <p className="text-sm font-black uppercase tracking-tight" style={{ color: c.textoNombre }}>
                                {datos.nombre || 'NOMBRE APELLIDO'}
                            </p>
                            {datos.cedula && (
                                <p className="text-[8px] font-bold tracking-widest mt-0.5" style={{ color: `${c.textoNombre}60` }}>
                                    C.I. {datos.cedula}
                                </p>
                            )}
                        </div>
                        <div>
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                                style={{ background: c.primario, color: c.textoHeader }}>
                                <Tag size={8} /> {datos.tipo_acceso || 'INVITADO'}
                            </span>
                        </div>
                    </div>

                    {/* Detalles — Compactos para no desperdigarse */}
                    <div className="space-y-1.5 px-2">
                        {[
                            { label: 'Entidad', valor: datos.entidad },
                            { label: 'Evento', valor: datos.evento },
                            { label: 'Vehículo', valor: datos.vehiculo_placa },
                            { label: 'Zona', valor: datos.zona_nombre },
                        ].filter(d => d.valor).map(d => (
                            <div key={d.label} className="flex justify-between items-center gap-4">
                                <span className="text-[7px] font-bold uppercase tracking-widest shrink-0" style={{ color: `${c.textoNombre}45` }}>{d.label}</span>
                                <span className="text-[8px] font-black uppercase text-right truncate" style={{ color: c.textoNombre }}>{d.valor}</span>
                            </div>
                        ))}
                    </div>

                    {/* QR — El protagonista */}
                    <div className="flex flex-col items-center pt-4 mt-2 mb-2 border-t w-full" style={{ borderColor: `${c.primario}15` }}>
                        {datos.qr ? (
                            <div className="bg-white rounded-lg p-1.5 flex items-center justify-center shrink-0" style={{ width: 140, height: 140 }}>
                                <QRCode value={datos.qr} size={128} level="M" />
                            </div>
                        ) : (
                            <QRPlaceholder size={140} />
                        )}
                    </div>

                    {/* Vigencia */}
                    <div className="text-center pt-1 mt-auto">
                        <p className="text-[7px] font-bold" style={{ color: `${c.textoNombre}50` }}>
                            Vigencia: {datos.fecha_inicio || '--/--'} — {datos.fecha_fin || '--/--'}
                        </p>
                    </div>
                </div>

                {/* Franja inferior (fijo) */}
                <div className="h-2 w-full shrink-0" style={{ background: c.primario }} />
            </div>
        </div>
    );
};

// ──── Export principal ─────────────────────────────────────────────────────────

const PLANTILLAS = {
    colgante: PlantillaColgante,
    cartera: PlantillaCartera,
    ticket: PlantillaTicket,
    credencial: PlantillaCredencial,
};

export default function PlantillaPreview({ plantilla = 'colgante', datos = {}, config = {} }) {
    const Componente = PLANTILLAS[plantilla] || PLANTILLAS.colgante;
    return <Componente datos={datos} config={config} />;
}

export { PLANTILLAS, PlantillaColgante, PlantillaCartera, PlantillaTicket, PlantillaCredencial, QRPlaceholder };
