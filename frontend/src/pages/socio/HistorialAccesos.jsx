import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/auth.store';

const HistorialAccesos = () => {
  const { token } = useAuthStore();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const SIZE = 15;

  const fetchHistorial = async (pageNum = 1, reset = false) => {
    try {
      if (reset) setLoading(true);
      const res = await api.get(`/accesos/me?page=${pageNum}&size=${SIZE}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newItems = res.data.items;
      if (reset) {
        setEventos(newItems);
      } else {
        setEventos(prev => [...prev, ...newItems]);
      }
      
      setHasMore(newItems.length === SIZE);
      setPage(pageNum);
    } catch (error) {
      console.error('Error cargando historial de accesos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial(1, true);
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchHistorial(page + 1);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-6 px-4 pb-24 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">BITÁCORA</h1>
          <p className="text-emerald-500/80 text-xs font-mono tracking-widest">REGISTRO DE ACCESOS</p>
        </div>
        <button 
          onClick={() => fetchHistorial(1, true)}
          className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 hover:bg-emerald-500/20 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {loading && eventos.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : eventos.length === 0 ? (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 text-center">
            <Search className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400 font-medium">No hay registros de acceso recientes</p>
            <p className="text-neutral-500 text-sm mt-1">Sus movimientos aparecerán aquí</p>
          </div>
        ) : (
          eventos.map((evento, index) => {
            const isEntrada = evento.tipo === 'entrada';
            
            return (
              <div 
                key={`${evento.id}-${index}`} 
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg ${isEntrada ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {isEntrada ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{evento.vehiculo}</p>
                    <p className="text-neutral-500 text-xs mt-0.5">{evento.punto}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-neutral-300 font-mono text-xs">
                    {new Date(evento.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-neutral-500 text-[10px] mt-0.5 uppercase tracking-wider">
                    {new Date(evento.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore && eventos.length > 0 && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="w-full py-3 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xl font-medium tracking-wide text-sm hover:bg-neutral-800 hover:text-white transition-colors"
        >
          {loading ? 'CARGANDO...' : 'CARGAR MÁS REGISTROS'}
        </button>
      )}
    </div>
  );
};

export default HistorialAccesos;
