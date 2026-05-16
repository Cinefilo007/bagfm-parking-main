import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, Polygon, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Shield, Building, SquareParking, Crosshair, Target, Edit3, AlertTriangle } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { useThemeStore } from '../store/theme.store';

// Fix para los iconos por defecto de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createTacticalPin = (color, label = "", isSelected = false, isDarkMode = true, IconComponent = Target) => {
  const pinBgColor = isDarkMode ? 'rgba(13, 17, 23, 0.9)' : '#FFFFFF';
  
  const html = renderToString(
    <div className={`tactical-marker-container ${isSelected ? 'is-selected' : ''}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer'
    }}>
      <div style={{
        position: 'relative',
        width: '32px',
        height: '32px',
        background: isSelected ? (isDarkMode ? '#FFFFFF' : '#10B981') : color,
        borderRadius: '50% 50% 50% 1px',
        transform: 'rotate(-45deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isSelected ? `0 0 15px ${isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(16,185,129,0.4)'}` : '0 4px 6px rgba(0,0,0,0.3)',
        border: `2px solid ${pinBgColor}`
      }}>
        <div style={{ transform: 'rotate(45deg)', color: pinBgColor }}>
           <IconComponent size={14} strokeWidth={3} />
        </div>
      </div>
    </div>
  );

  return L.divIcon({
    className: 'custom-tactical-pin',
    html: html,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
};

function MapClickHandler({ onMapClick, assignmentMode, drawingMode }) {
  useMapEvents({
    click: (e) => {
      if ((assignmentMode || drawingMode) && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapResizer({ isFullscreen }) {
  const map = useMapEvents({});
  React.useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100); 
  }, [isFullscreen, map]);
  return null;
}

const MapaBaseReal = ({ 
  situacion, 
  onSelectEntity, 
  assignmentMode, 
  drawingMode = false, 
  tempPoints = [], 
  onPointMoved = null, 
  onPointDeleted = null,
  accessPoints = [],
  aiSuggestions = null, 
  incidentes = [],
  showPolygons = true, 
  onMapClick = null, 
  selectedForMove = null, 
  isFullscreen = false,
  hideSituacion = false
}) => {
  const { isDarkMode } = useThemeStore();
  const [mapType, setMapType] = React.useState('satellite'); 
  
  const IncidentIcon = (props) => (
    <div className="animate-pulse">
       <AlertTriangle {...props} />
    </div>
  );

  // Perímetro EXACTO de la Base Aérea (Según captura del Comandante)
  const boundsBase = [
      [10.4750, -66.8650], // Suroeste (Fin de pista oeste / Colinas)
      [10.5050, -66.8150]  // Noreste (Fin de pista este / Autopista)
  ];

  const hasCoords = (item) => {
      return item && typeof item.latitud === 'number' && typeof item.longitud === 'number';
  };

  return (
    <div className="w-full h-full bg-bg-app relative flex flex-col gap-4">
      <div className="flex-1 min-h-[400px] border border-white/5 rounded-2xl shadow-tactica overflow-hidden relative z-0">
          
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <button 
                onClick={() => setMapType(mapType === 'satellite' ? 'tactical' : 'satellite')}
                className="p-3 bg-bg-modal/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl hover:bg-primary/20 hover:border-primary/40 transition-all group"
              >
                  {mapType === 'satellite' ? (
                    <div className="flex items-center gap-2">
                        <Shield size={16} className="text-primary group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Táctica</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                        <Building size={16} className="text-primary group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Satelital</span>
                    </div>
                  )}
              </button>
          </div>

        <style>
          {`
            .leaflet-control-attribution { display: none !important; }
            .leaflet-container { background: #09090b !important; }
            .tactical-label { pointer-events: none !important; }
          `}
        </style>
        <MapContainer 
            center={[10.490, -66.840]} 
            zoom={15} 
            maxZoom={20}
            maxBounds={boundsBase}
            maxBoundsViscosity={1.0}
            minZoom={15}
            style={{ height: '100%', width: '100%', background: '#0D1117' }}
            zoomControl={mapType === 'satellite'}
            className="tactical-map-container"
          >
            {mapType === 'satellite' ? (
               <TileLayer
                 url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                 attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                 maxNativeZoom={19}
                 maxZoom={20}
               />
            ) : (
               <TileLayer 
                 url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
               />
            )}

            <MapClickHandler onMapClick={onMapClick} assignmentMode={assignmentMode} drawingMode={drawingMode} />
            <MapResizer isFullscreen={isFullscreen} />

            {situacion && (
              <>
                {/* ALCABALAS - Solo pines */}
                {!hideSituacion && situacion.alcabalas?.filter(hasCoords).map(alcabala => (
                  <Marker 
                    key={`alcabala-${alcabala.id}`}
                    position={[alcabala.latitud, alcabala.longitud]}
                    icon={createTacticalPin(
                      '#10B981', 
                      alcabala.nombre, 
                      selectedForMove?.id === alcabala.id && selectedForMove?.tipo === 'alcabala', 
                      isDarkMode,
                      Shield
                    )}
                    eventHandlers={{ click: () => !assignmentMode && onSelectEntity(alcabala) }}
                  >
                    <Popup className="tactical-popup">
                        <div className="p-1">
                            <div className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">Control de Acceso</div>
                            <div className="text-[11px] font-bold uppercase text-text-main mb-2">{alcabala.nombre}</div>
                            <div className="flex justify-between items-center text-[9px] font-mono border-t border-bg-high/20 pt-2">
                               <span className="text-text-sec uppercase font-bold">Estado:</span>
                               <span className="text-primary font-black">ACTIVA</span>
                            </div>
                        </div>
                    </Popup>
                  </Marker>
                ))}

                {/* ENTIDADES - Solo pines */}
                {!hideSituacion && situacion.entidades?.filter(hasCoords).map(entidad => (
                  <Marker 
                    key={`entidad-${entidad.id}`}
                    position={[entidad.latitud, entidad.longitud]}
                    icon={createTacticalPin(
                      '#8B5CF6', 
                      entidad.nombre, 
                      selectedForMove?.id === entidad.id && selectedForMove?.tipo === 'entidad', 
                      isDarkMode,
                      Building
                    )}
                    eventHandlers={{ click: () => !assignmentMode && onSelectEntity(entidad) }}
                  >
                    <Popup className="tactical-popup">
                        <div className="p-1">
                            <div className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-0.5">Sede Administrativa</div>
                            <div className="text-[11px] font-display font-black uppercase text-text-main mb-2 tracking-tight">{entidad.nombre}</div>
                            <div className="flex justify-between items-center text-[9px] font-mono border-t border-bg-high/20 pt-2">
                               <span className="text-text-sec font-bold uppercase">Uso:</span>
                               <span className="text-primary font-black text-[11px]">{entidad.ocupacion_actual || 0} / {entidad.capacidad_total || 0}</span>
                            </div>
                        </div>
                    </Popup>
                  </Marker>
                ))}

                {/* ZONAS DE ESTACIONAMIENTO - Polígonos siempre, Pines opcionales */}
                {situacion.zonas_estacionamiento?.map(zona => (
                  <React.Fragment key={`zona-group-${zona.id}`}>
                    {/* El polígono permanece visible para referencia espacial */}
                    {zona.poligono && Array.isArray(zona.poligono) && zona.poligono.length >= 3 && showPolygons && (
                        <Polygon 
                          positions={zona.poligono}
                          pathOptions={{
                             fillColor: '#F59E0B',
                             fillOpacity: selectedForMove?.id === zona.id ? 0.3 : 0.15,
                             color: '#F59E0B',
                             weight: 2,
                             dashArray: '5, 5'
                          }}
                        >
                          <Popup className="tactical-popup">
                             <div className="p-2 min-w-[130px]">
                                 <div className="text-[9px] font-black uppercase tracking-widest text-warning mb-0.5">Área Delimitada</div>
                                 <div className="text-[11px] font-bold uppercase text-text-main mb-1 leading-tight">{zona.nombre}</div>
                                 <div className="flex justify-between items-center text-[9px] font-mono border-t border-white/10 pt-2 mb-2">
                                     <span className="text-text-sec uppercase font-bold">Uso:</span>
                                     <span className="text-primary font-black text-[11px]">{zona.ocupacion_actual || 0} / {zona.capacidad_total || 0}</span>
                                  </div>
                                  {drawingMode && (
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         onPointDeleted && onPointDeleted(-1, zona.poligono);
                                       }}
                                       className="w-full py-1.5 bg-warning text-black text-[9px] font-black uppercase rounded shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5"
                                     >
                                       <Edit3 size={10} /> EDITAR ÁREA
                                      </button>
                                  )}
                              </div>
                           </Popup>
                        </Polygon>
                    )}

                    {/* La grilla táctica interna se oculta con la capa de polígonos */}
                    {showPolygons && zona.grilla_tactica?.map((linea, idx) => (
                      <Polyline 
                          key={`saved-grid-${zona.id}-${idx}`}
                          positions={linea.points || linea} 
                          pathOptions={{ 
                              color: linea.color || '#F59E0B', 
                              weight: linea.type === 'via' ? 1.5 : (linea.type === 'divisor_doble' ? 2 : 0.8), 
                              opacity: linea.type === 'divisor_doble' ? 0.9 : 0.5,
                              dashArray: linea.type === 'via' ? '5, 8' : '0' 
                          }} 
                      />
                    ))}

                    {/* El Pin se oculta para despejar el área de edición */}
                    {!hideSituacion && hasCoords(zona) && (
                      <Marker 
                        position={[zona.latitud, zona.longitud]}
                        icon={createTacticalPin(
                          '#F59E0B', 
                          zona.nombre, 
                          selectedForMove?.id === zona.id && selectedForMove?.tipo === 'zona', 
                          isDarkMode, 
                          SquareParking
                        )}
                        eventHandlers={{ click: () => !assignmentMode && onSelectEntity(zona) }}
                      >
                          <Popup className="tactical-popup">
                             <div className="p-2 min-w-[130px]">
                                 <div className="text-[9px] font-black uppercase tracking-widest text-warning mb-0.5">Área Delimitada</div>
                                 <div className="text-[11px] font-bold uppercase text-text-main mb-1 leading-tight">{zona.nombre}</div>
                                 <div className="flex justify-between items-center text-[9px] font-mono border-t border-white/10 pt-2 mb-2">
                                     <span className="text-text-sec uppercase font-bold">Uso:</span>
                                     <span className="text-primary font-black text-[11px]">{zona.ocupacion_actual || 0} / {zona.capacidad_total || 0}</span>
                                  </div>
                              </div>
                           </Popup>
                      </Marker>
                    )}
                  </React.Fragment>
                ))}
              </>
            )}

            {/* INCIDENTES / INFRACCIONES */}
            {incidentes?.filter(i => i.lat && i.lon).map(inc => (
                <Marker 
                    key={`incidente-${inc.id}`}
                    position={[inc.lat, inc.lon]}
                    icon={createTacticalPin(
                        '#EF4444', 
                        inc.tipo, 
                        false, 
                        isDarkMode, 
                        AlertTriangle
                    )}
                >
                    <Popup className="tactical-popup">
                        <div className="p-1">
                            <div className="text-[8px] font-black uppercase tracking-widest text-danger mb-0.5">Incidente Reportado</div>
                            <div className="text-[11px] font-bold uppercase text-text-main mb-1">{inc.tipo}</div>
                            <div className="text-[9px] font-bold text-text-muted mb-2 italic">"{inc.descripcion}"</div>
                            <div className="flex justify-between items-center text-[9px] font-mono border-t border-bg-high/20 pt-2">
                                <span className="text-text-sec uppercase font-bold">Placa:</span>
                                <span className="text-danger font-black">{inc.placa}</span>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}

            {/* TRAZADO ACTIVO (Lo que el usuario está dibujando) */}
            {tempPoints && tempPoints.length > 0 && (
                <>
                  <Polyline 
                    positions={tempPoints} 
                    pathOptions={{ color: '#4EDEA3', weight: 4, dashArray: '10, 10' }} 
                  />
                  {tempPoints.map((p, i) => (
                    <Marker 
                      key={`temp-pt-${i}`}
                      position={p}
                      draggable={true}
                      icon={L.divIcon({
                        className: 'tactical-vertex',
                        html: `<div class="w-3 h-3 bg-primary rounded-full border-2 border-white shadow-[0_0_15px_rgba(78,222,163,0.8)]"></div>`,
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                      })}
                      eventHandlers={{
                        dragend: (e) => {
                            const { lat, lng } = e.target.getLatLng();
                            onPointMoved && onPointMoved(i, lat, lng);
                        },
                        contextmenu: () => {
                            onPointDeleted && onPointDeleted(i);
                        }
                      }}
                    />
                  ))}
                  {tempPoints.length >= 3 && (
                    <Polygon 
                      positions={tempPoints}
                      pathOptions={{ fillColor: '#4EDEA3', fillOpacity: 0.15, weight: 0 }}
                    />
                  )}
                </>
            )}

            {/* Marcadores de Acceso (Entrada/Salida) */}
            {accessPoints?.map((ap, i) => (
                <Marker 
                    key={`ap-${i}`} 
                    position={[ap.lat, ap.lng]}
                    icon={L.divIcon({
                        className: 'custom-div-icon',
                        html: `
                            <div class="flex flex-col items-center">
                                <div class="px-2 py-0.5 ${ap.type === 'entry' ? 'bg-primary' : 'bg-danger'} text-bg-app text-[8px] font-black rounded-full shadow-lg animate-bounce">
                                    ${ap.type === 'entry' ? 'ENTRADA' : 'SALIDA'}
                                </div>
                                <div class="w-2 h-2 ${ap.type === 'entry' ? 'bg-primary' : 'bg-danger'} rounded-full border border-white shadow-lg"></div>
                            </div>
                        `,
                        iconSize: [60, 40],
                        iconAnchor: [30, 40]
                    })}
                />
            ))}
            
            {showPolygons && aiSuggestions?.lineas?.map((linea, i) => (
                <Polyline 
                    key={`ai-loc-${i}`} 
                    positions={linea.points || linea} 
                    pathOptions={{ 
                        color: linea.color || '#818cf8', 
                        weight: linea.type === 'via' ? 2 : (linea.type === 'divisor_doble' ? 4 : 1), 
                        opacity: linea.type === 'divisor_doble' ? 1 : 0.8, 
                        dashArray: linea.type === 'via' ? '5, 10' : '0'
                    }} 
                />
            ))}

            {/* Numeración de Puestos IA */}
            {showPolygons && aiSuggestions?.puestos?.map((p, i) => (
                <Marker 
                    key={`ai-num-${i}`}
                    position={p.center}
                    icon={L.divIcon({
                        className: 'tactical-label',
                        html: `
                            <div style="
                                background: #A855F7;
                                color: white;
                                width: 14px;
                                height: 14px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                border-radius: 3px;
                                font-size: 8px;
                                font-weight: 900;
                                font-family: sans-serif;
                                border: 1px solid white;
                                box-shadow: 0 0 5px rgba(0,0,0,0.5);
                            ">
                                ${p.number}
                            </div>
                        `,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    })}
                    zIndexOffset={1000}
                />
            ))}
          </MapContainer>
      </div>
    </div>
  );
};

export default MapaBaseReal;
