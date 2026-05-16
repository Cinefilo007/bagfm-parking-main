import React, { useMemo } from 'react';
import { Shield, Building, SquareParking } from 'lucide-react';

/**
 * MapaBaseSVG: Un componente que renderiza el perímetro táctico de la base
 * utilizando un SVG dinámico basado en coordenadas reales de La Carlota.
 */
const MapaBaseSVG = ({ situacion, onSelectEntity }) => {
  // Límites aproximados del perímetro de La Carlota (BAGFM)
  const BOUNDS = {
    latMin: 10.4750,
    latMax: 10.4960,
    lonMin: -66.8600,
    lonMax: -66.8200
  };

  // Coordenadas del polígono del perímetro (REALISTAS de La Carlota)
  const PERIMETRO_NODOS = [
    { lat: 10.4905, lon: -66.8545 }, // NW (Cerca de Cubo Negro / Autopista)
    { lat: 10.4925, lon: -66.8450 }, // Norte (Frente a CCCT)
    { lat: 10.4938, lon: -66.8350 }, // Norte (Cerca del Distribuidor Altamira)
    { lat: 10.4915, lon: -66.8275 }, // NE (Límite con Parque del Este)
    { lat: 10.4850, lon: -66.8265 }, // Este (Entrada Santa Cecilia)
    { lat: 10.4795, lon: -66.8380 }, // SE (Curso del Río Guaire)
    { lat: 10.4785, lon: -66.8480 }, // Sur (Curva del Río Guaire)
    { lat: 10.4815, lon: -66.8560 }, // SW (Chuao)
    { lat: 10.4860, lon: -66.8575 }  // Oeste (Punta final)
  ];

  // Función de proyección: Coordenada Geográfica -> Coordenada SVG (0-1000)
  const proyectar = (lat, lon) => {
    const x = ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * 1000;
    const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * 1000;
    return { x, y };
  };

  // Generar el path del perímetro
  const perimetroPath = useMemo(() => {
    return PERIMETRO_NODOS.map((n, i) => {
      const { x, y } = proyectar(n.lat, n.lon);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z';
  }, []);

  // Proyectar pista (Runway 08/26)
  const pistaStart = proyectar(10.4845, -66.8525);
  const pistaEnd = proyectar(10.4895, -66.8290);

  // Proyectar entidades
  const renderEntidades = (lista, icono, color) => {
    return lista.map(item => {
      if (!item.latitud || !item.longitud) return null;
      const { x, y } = proyectar(item.latitud, item.longitud);
      const IconComp = icono;
      
      return (
        <g key={item.id} 
           className="cursor-pointer group" 
           onClick={() => onSelectEntity(item)}
           style={{ transition: 'all 0.3s ease' }}
        >
          {/* Aura / Glow */}
          <circle cx={x} cy={y} r="14" fill={color} fillOpacity="0" className="group-hover:fill-opacity-10 transition-all duration-300" />
          <circle cx={x} cy={y} r="10" fill={color} fillOpacity="0.05" className="animate-pulse" />
          
          {/* Nodo Táctico */}
          <rect x={x-4} y={y-4} width="8" height="8" transform={`rotate(45 ${x} ${y})`} fill={color} className="group-hover:scale-125 transition-transform" />
          
          {/* Línea conectora sutil en hover */}
          <line x1={x} y1={y} x2={x} y2={y-20} stroke={color} strokeWidth="1" strokeDasharray="2 2" className="opacity-0 group-hover:opacity-40 transition-opacity" />

          {/* Etiqueta flotante sutil */}
          <text x={x} y={y - 25} textAnchor="middle" fill="white" fontSize="9" className="opacity-0 group-hover:opacity-100 font-display font-black uppercase tracking-widest pointer-events-none drop-shadow-md">
            {item.nombre}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="w-full h-full bg-bg-app relative overflow-hidden flex flex-col border border-white/5 rounded-xl shadow-tactica">
      {/* HUD Header */}
      <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-danger animate-pulse"></div>
             <span className="text-[11px] font-display font-black text-primary tracking-[0.4em] uppercase">Tactical Overlook // BAGFM</span>
          </div>
          <span className="text-[8px] font-mono text-text-muted mt-1 uppercase tracking-tighter">SIGINT Level 04 // PERIMETER SECURED</span>
        </div>
        <div className="flex flex-col items-end">
           <span className="text-[8px] font-display text-text-muted uppercase tracking-widest">Coordenadas Centro</span>
           <span className="text-[10px] font-mono text-text-main font-bold">10.4851N / -66.8436W</span>
        </div>
      </div>

      {/* SVG Map Container */}
      <div className="flex-1 relative cursor-crosshair">
        <svg viewBox="0 0 1000 1000" className="w-full h-full p-8 md:p-12">
          {/* Background Grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(78, 222, 163, 0.04)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="1000" height="1000" fill="url(#grid)" />

          {/* Runway (Orientación Real) */}
          <line 
            x1={pistaStart.x} y1={pistaStart.y} 
            x2={pistaEnd.x} y2={pistaEnd.y} 
            stroke="rgba(78, 222, 163, 0.08)" 
            strokeWidth="35" 
            strokeDasharray="15 8"
          />
          <line 
            x1={pistaStart.x} y1={pistaStart.y} 
            x2={pistaEnd.x} y2={pistaEnd.y} 
            stroke="rgba(78, 222, 163, 0.15)" 
            strokeWidth="1" 
          />

          {/* Base Perimeter */}
          <path 
            d={perimetroPath} 
            fill="rgba(16, 185, 129, 0.03)" 
            stroke="rgba(16, 185, 129, 0.4)" 
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="transition-all duration-1000"
          />

          {/* Renderizado de Entidades Tácticas */}
          {situacion && (
            <>
              {/* Zonas de Estacionamiento */}
              {situacion.zonas_estacionamiento.map(zona => {
                 if (!zona.latitud || !zona.longitud) return null;
                 const { x, y } = proyectar(zona.latitud, zona.longitud);
                 const perc = Math.min((zona.ocupacion_actual / zona.capacidad_total), 1);
                 const color = perc > 0.9 ? '#FFAB4B' : perc > 0.7 ? '#F59E0B' : '#4EDEA3';
                 
                 return (
                   <g key={zona.id} className="cursor-pointer group" onClick={() => onSelectEntity(zona)}>
                      {/* Círculo indicador de ocupación */}
                      <circle cx={x} cy={y} r="18" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.2" />
                      <circle 
                        cx={x} cy={y} r="18" fill="none" stroke={color} strokeWidth="2" 
                        strokeDasharray={`${perc * 113} 113`} 
                        transform={`rotate(-90 ${x} ${y})`}
                        strokeLinecap="round"
                      />
                      {/* Icono sutil */}
                      <rect x={x-6} y={y-6} width="12" height="12" fill={color} fillOpacity="0.1" rx="2" />
                      <text x={x} y={y+2} textAnchor="middle" fill={color} fontSize="8" fontWeight="black" className="pointer-events-none">P</text>
                      
                      {/* Nombre en Hover */}
                      <text x={x} y={y + 35} textAnchor="middle" fill="white" fontSize="8" className="opacity-0 group-hover:opacity-100 font-display font-bold uppercase tracking-tighter fill-text-sec pointer-events-none">
                        {zona.nombre} ({Math.round(perc*100)}%)
                      </text>
                   </g>
                 );
              })}

              {/* Alcabalas */}
              {renderEntidades(situacion.alcabalas, Shield, '#4EDEA3')}
              
              {/* Entidades Civiles */}
              {renderEntidades(situacion.entidades, Building, '#DEE1F7')}
            </>
          )}
        </svg>
      </div>

      {/* Footer / Legend */}
      <div className="p-4 bg-bg-low/70 border-t border-white/5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex gap-6">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary shadow-[0_0_5px_rgba(78,222,163,0.5)]"></div>
                <span className="text-[9px] uppercase font-black text-text-sec tracking-widest">Puntos de Acceso Acceso</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-warning shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div>
                <span className="text-[9px] uppercase font-black text-text-sec tracking-widest">Zonas de Parking</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[9px] font-mono text-success flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-success"></div>
                UPLINK STABLE
             </span>
             <span className="text-[9px] font-mono text-text-muted">v0.4.2-TAC</span>
          </div>
      </div>
    </div>
  );
};

export default MapaBaseSVG;
