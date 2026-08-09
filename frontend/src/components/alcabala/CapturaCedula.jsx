import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Check, Zap, ZapOff, AlertTriangle } from 'lucide-react';

import { Boton } from '../ui/Boton';

/**
 * Captura de la cédula con la cámara dentro del propio navegador.
 *
 * Antes esto era un `<input type="file" capture>`: el teléfono abría su aplicación de
 * cámara, el guardia salía de la pantalla, volvía con una foto de 4000 píxeles y sin
 * ninguna guía de encuadre. Tres problemas, y los tres se notan en la fila:
 *
 *   - Salir de la aplicación pierde el contexto y confunde a quien llega de relevo.
 *   - Una foto entera del teléfono lleva la cédula pequeña en una esquina y con medio
 *     tablero de fondo; la IA lee mucho peor eso que un recorte limpio del documento.
 *   - Esa misma foto pesa varios megas. Súbela treinta veces en una hora pico y lo que
 *     falla no es la lectura, es la red y la cuota del modelo.
 *
 * Aquí el guardia ve el marco, encaja la cédula dentro y lo que se manda es SOLO ese
 * recorte, reescalado a un tamaño razonable. Menos datos, mejor lectura.
 *
 * Si la cámara no se puede abrir —permiso denegado, o un navegador sin HTTPS— se cae
 * al `<input type="file">` de siempre. Vale más una foto imperfecta que ninguna.
 */

// Proporción de una cédula (formato ID-1, 85.6 × 54 mm). El marco la respeta para que
// el documento encaje justo y el recorte no arrastre fondo inútil.
const PROPORCION_CEDULA = 85.6 / 54;

// Ancho máximo del recorte que se envía. Por encima de esto la lectura no mejora y
// solo se pagan megas de subida.
const ANCHO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.85;

export const CapturaCedula = ({ onFoto, onCerrar }) => {
  const videoRef = useRef(null);
  const guiaRef = useRef(null);
  const flujoRef = useRef(null);
  const entradaArchivo = useRef(null);

  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [previa, setPrevia] = useState(null);   // { url, base64 }
  const [linterna, setLinterna] = useState(false);
  const [tieneLinterna, setTieneLinterna] = useState(false);

  // ── Encender la cámara ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;

    const abrir = async () => {
      try {
        const flujo = await navigator.mediaDevices.getUserMedia({
          // `ideal` y no `exact`: en una tablet sin cámara trasera, exigirla haría
          // fallar la apertura entera en vez de conformarse con la frontal.
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
          audio: false,
        });

        if (cancelado) {
          flujo.getTracks().forEach((t) => t.stop());
          return;
        }

        flujoRef.current = flujo;
        if (videoRef.current) {
          videoRef.current.srcObject = flujo;
          await videoRef.current.play().catch(() => {});
        }

        const pista = flujo.getVideoTracks()[0];
        setTieneLinterna(Boolean(pista?.getCapabilities?.().torch));
        setListo(true);
      } catch {
        if (!cancelado) setError('camara');
      }
    };

    abrir();
    return () => {
      cancelado = true;
      flujoRef.current?.getTracks().forEach((t) => t.stop());
      flujoRef.current = null;
    };
  }, []);

  const alternarLinterna = useCallback(async () => {
    const pista = flujoRef.current?.getVideoTracks?.()[0];
    if (!pista) return;
    try {
      await pista.applyConstraints({ advanced: [{ torch: !linterna }] });
      setLinterna((v) => !v);
    } catch {
      setTieneLinterna(false);
    }
  }, [linterna]);

  // ── Recortar lo que hay dentro del marco ────────────────────────────────────
  const capturar = useCallback(() => {
    const video = videoRef.current;
    const guia = guiaRef.current;
    if (!video || !guia || !video.videoWidth) return;

    const rectVideo = video.getBoundingClientRect();
    const rectGuia = guia.getBoundingClientRect();

    // El vídeo se pinta con object-fit: cover, así que lo que se ve en pantalla es un
    // trozo centrado del fotograma real. Sin deshacer ese encuadre, el recorte saldría
    // desplazado justo cuando la proporción de la pantalla no coincide con la de la
    // cámara — es decir, casi siempre.
    const escala = Math.max(
      rectVideo.width / video.videoWidth,
      rectVideo.height / video.videoHeight
    );
    const desplazadoX = (video.videoWidth * escala - rectVideo.width) / 2;
    const desplazadoY = (video.videoHeight * escala - rectVideo.height) / 2;

    const origenX = (rectGuia.left - rectVideo.left + desplazadoX) / escala;
    const origenY = (rectGuia.top - rectVideo.top + desplazadoY) / escala;
    const anchoOrigen = rectGuia.width / escala;
    const altoOrigen = rectGuia.height / escala;

    const anchoDestino = Math.min(ANCHO_MAXIMO, Math.round(anchoOrigen));
    const altoDestino = Math.round(anchoDestino * (altoOrigen / anchoOrigen));

    const lienzo = document.createElement('canvas');
    lienzo.width = anchoDestino;
    lienzo.height = altoDestino;
    const ctx = lienzo.getContext('2d');
    ctx.drawImage(
      video,
      Math.max(0, origenX), Math.max(0, origenY), anchoOrigen, altoOrigen,
      0, 0, anchoDestino, altoDestino
    );

    const dataUrl = lienzo.toDataURL('image/jpeg', CALIDAD_JPEG);
    setPrevia({ url: dataUrl, base64: dataUrl.split(',')[1] });
  }, []);

  // ── Respaldo: la cámara del sistema ─────────────────────────────────────────
  const alElegirArchivo = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => onFoto(String(lector.result).split(',')[1]);
    lector.readAsDataURL(archivo);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">
          Encuadre la cédula
        </p>
        <div className="flex items-center gap-1">
          {tieneLinterna && (
            <button
              type="button"
              onClick={alternarLinterna}
              className="rounded-full p-2 text-white/80 hover:bg-white/10"
              title={linterna ? 'Apagar la luz' : 'Encender la luz'}
            >
              {linterna ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full p-2 text-white/80 hover:bg-white/10"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {previa ? (
          <img src={previa.url} alt="Cédula capturada" className="h-full w-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />

            {/* El marco: borde luminoso y esquinas marcadas. Fuera de él se oscurece
                con una sombra enorme, que es la forma barata de recortar un hueco. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                ref={guiaRef}
                className="relative w-[86%] max-w-md rounded-xl"
                style={{
                  aspectRatio: String(PROPORCION_CEDULA),
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                  border: '2px solid rgba(255,255,255,0.85)',
                }}
              >
                {[
                  'left-0 top-0 border-l-4 border-t-4 rounded-tl-xl',
                  'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl',
                  'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-xl',
                  'right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl',
                ].map((posicion) => (
                  <span
                    key={posicion}
                    className={`absolute h-8 w-8 border-primary ${posicion}`}
                  />
                ))}
              </div>
            </div>

            {error === 'camara' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-8 text-center">
                <AlertTriangle className="h-10 w-10 text-warning" />
                <p className="text-sm font-bold text-white">
                  No se pudo abrir la cámara
                </p>
                <p className="text-xs text-white/70">
                  Puede tomar la foto con la cámara del teléfono.
                </p>
                <Boton size="sm" onClick={() => entradaArchivo.current?.click()}>
                  <Camera className="h-4 w-4" /> Usar la cámara del teléfono
                </Boton>
              </div>
            )}
          </>
        )}
      </div>

      <input
        ref={entradaArchivo}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={alElegirArchivo}
        className="hidden"
      />

      <div className="flex items-center justify-center gap-3 px-4 py-5">
        {previa ? (
          <>
            <Boton variant="outline" className="flex-1 border-white/30 text-white" onClick={() => setPrevia(null)}>
              <RotateCcw className="h-4 w-4" /> Repetir
            </Boton>
            <Boton className="flex-[2]" onClick={() => onFoto(previa.base64)}>
              <Check className="h-4 w-4" /> Usar esta foto
            </Boton>
          </>
        ) : (
          <>
            <p className="mr-auto max-w-[45%] text-[11px] leading-tight text-white/60">
              Llene el marco con la cédula. Evite reflejos y sombras.
            </p>
            <button
              type="button"
              onClick={capturar}
              disabled={!listo}
              title="Tomar la foto"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white/80 bg-white/10 transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className="h-11 w-11 rounded-full bg-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
