import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MonitorCheck, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Header } from '../../components/layout/Header';
import { anprService } from '../../services/anpr.service';

/**
 * Confirmación de una pantalla desde el teléfono del guardia.
 *
 * Se llega aquí escaneando el QR que muestra el televisor. La pantalla queda atada a
 * la alcabala de quien confirma, así que el guardia no tiene que elegir nada: su
 * cuenta ya dice en qué garita está.
 *
 * La vista es deliberadamente explícita sobre qué se está autorizando. Un flujo de
 * emparejamiento es exactamente donde alguien podría enseñar un código ajeno para
 * colar un aparato suyo, y la única defensa real es que quien confirma vea con
 * claridad qué va a pasar.
 */
const ConfirmarPantalla = () => {
  const { codigo } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const consultar = useCallback(async () => {
    try {
      const datos = await anprService.consultarEmparejamiento(codigo);
      setInfo(datos);
      setNombre(datos.punto_nombre ? `TV ${datos.punto_nombre}` : 'TV Alcabala');
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo leer el código');
    }
  }, [codigo]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { consultar(); }, [consultar]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await anprService.confirmarEmparejamiento(codigo, nombre.trim() || null);
      setListo(true);
      toast.success('Pantalla autorizada');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo autorizar');
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app">
      <Header titulo="Autorizar pantalla" subtitle="Emparejamiento de monitor" />

      <main className="mt-[-1rem] space-y-4 px-4 pb-24 lg:px-8">
        {error && (
          <Card elevation={2} className="border-error/30">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-error" />
              <div>
                <p className="text-sm font-bold text-text-main">{error}</p>
                <p className="mt-1 text-xs text-text-sec">
                  Los códigos vencen a los 5 minutos. Si ya pasó ese tiempo, el
                  televisor habrá generado uno nuevo: vuelva a escanearlo.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Boton variant="ghost" onClick={() => navigate('/alcabala/dashboard')}>Volver</Boton>
            </div>
          </Card>
        )}

        {!error && !info && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {listo && (
          <Card elevation={2} className="border-success/30 py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="mt-4 text-sm font-bold uppercase tracking-wide text-text-main">
              Pantalla autorizada
            </p>
            <p className="mt-1 text-xs text-text-sec">
              El televisor debería mostrar los datos en unos segundos.
            </p>
            <div className="mt-6">
              <Boton onClick={() => navigate('/alcabala/puerta')}>Ir a Puerta</Boton>
            </div>
          </Card>
        )}

        {!error && info && !listo && (
          <Card elevation={2} className="border-bg-high/10">
            <div className="flex items-start gap-3">
              <MonitorCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold text-text-main">
                  Va a autorizar un televisor
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-sec">
                  Quedará asignado a <strong className="text-text-main">{info.punto_nombre}</strong> y
                  solo podrá <strong>mostrar</strong> las detecciones de esa puerta. No podrá
                  registrar accesos ni ver otra alcabala.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-bg-low p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-sec">
                Código mostrado en el televisor
              </p>
              <p className="mt-1 font-mono text-3xl font-black tracking-widest text-text-main">
                {info.codigo.slice(0, 3)}-{info.codigo.slice(3)}
              </p>
            </div>

            <p className="mt-3 text-[11px] text-text-sec">
              Confirme solo si este código coincide con el que ve en la pantalla que
              tiene delante.
            </p>

            <div className="mt-4">
              <Input
                label="Nombre para identificarla"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: TV Alcabala Principal"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Boton variant="ghost" onClick={() => navigate(-1)} disabled={enviando}>
                Cancelar
              </Boton>
              <Boton onClick={confirmar} isLoading={enviando}>
                Autorizar pantalla
              </Boton>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ConfirmarPantalla;
