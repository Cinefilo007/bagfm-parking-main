import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, Power } from 'lucide-react';
import { cn } from '../../lib/utils';

export const QRScanner = forwardRef(({ onScanSuccess, autoStart = false, status = 'idle' }, ref) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  
  const html5QrCode = useRef(null);
  const lastTokenRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  // Exponer métodos al padre para los botones de abajo
  useImperativeHandle(ref, () => ({
    switchCamera: () => switchCamera(),
    toggleScanner: () => isScanning ? stopScanner() : startScanner(currentCameraIndex),
    isScanning: isScanning,
    camerasCount: cameras.length
  }));

  const loadCameras = async () => {
      try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
              setCameras(devices);
              // Filtrar cámaras traseras
              const backCameras = devices.filter(d => 
                d.label.toLowerCase().includes('back') || 
                d.label.toLowerCase().includes('rear')
              );
              
              if (backCameras.length > 0) {
                  // Intentar buscar la principal: Evitar las que digan "wide" o "ultra"
                  const mainCamera = backCameras.find(d => 
                    !d.label.toLowerCase().includes('wide') && 
                    !d.label.toLowerCase().includes('ultra')
                  ) || backCameras[0]; // Si no, la primera trasera suele ser la main en muchos dispositivos

                  const targetIdx = devices.indexOf(mainCamera);
                  setCurrentCameraIndex(targetIdx > -1 ? targetIdx : 0);
              }
          }
      } catch (e) {
          console.error("Error cargando cámaras:", e);
      }
  };

  useEffect(() => {
      loadCameras();
  }, []);

  const startScanner = async (forcedIndex = null) => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
        await stopScanner();
    }
    
    try {
      setCameraError(null);
      setIsScanning(true);
      
      const qrCodeId = "reader-container";
      html5QrCode.current = new Html5Qrcode(qrCodeId);
      
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.85);
            return { width: size, height: size };
        },
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      };

      const cameraId = forcedIndex !== null && cameras[forcedIndex] 
        ? cameras[forcedIndex].id 
        : { facingMode: "environment" };

      await html5QrCode.current.start(
        cameraId,
        config,
        (decodedText) => {
          const now = Date.now();
          if (decodedText === lastTokenRef.current && (now - lastScanTimeRef.current) < 3000) return;

          lastTokenRef.current = decodedText;
          lastScanTimeRef.current = now;

          setSuccessFlash(true);
          if (navigator.vibrate) navigator.vibrate(100);
          onScanSuccess(decodedText);
          setTimeout(() => setSuccessFlash(false), 500);
        },
        () => {} 
      );
    } catch (err) {
      console.error("FALLO CÁMARA:", err);
      setCameraError(`Fallo de sensor: ${err.message || 'Sin acceso'}`);
      setIsScanning(false);
    }
  };

  const switchCamera = () => {
      if (cameras.length < 2) return;
      const nextIdx = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIdx);
      startScanner(nextIdx);
  };

  const stopScanner = async () => {
    if (html5QrCode.current) {
      if (html5QrCode.current.isScanning) {
          try {
              await html5QrCode.current.stop();
          } catch (e) {
              console.warn("Error deteniendo el sensor:", e);
          }
      }
      try {
          await html5QrCode.current.clear();
      } catch (e) {}
      html5QrCode.current = null;
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCode.current) {
          try {
              if (html5QrCode.current.isScanning) {
                  html5QrCode.current.stop().catch(() => {}).finally(() => {
                      try { html5QrCode.current.clear().catch(() => {}); } catch(e){}
                  });
              } else {
                  try { html5QrCode.current.clear().catch(() => {}); } catch(e){}
              }
          } catch (e) {
              console.warn("Error en cleanup de scanner", e);
          }
      }
    };
  }, []);

  useEffect(() => {
    if (autoStart && cameras.length > 0) {
      const timer = setTimeout(() => startScanner(currentCameraIndex), 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, cameras.length]);

  return (
    <div 
        onClick={() => isScanning ? stopScanner() : startScanner(currentCameraIndex)}
        className={cn(
            "relative overflow-hidden rounded-[2.5rem] border-2 shadow-2xl w-full aspect-square flex items-center justify-center transition-all duration-700 bg-black/40 cursor-pointer active:scale-95",
            status === 'idle' && "border-white/10",
            status === 'success' && "border-primary shadow-[0_0_40px_rgba(var(--primary-rgb),0.3)]",
            status === 'error' && "border-error shadow-[0_0_40px_rgba(239,68,68,0.3)]",
            !isScanning && "hover:border-primary/40"
        )}
    >
        <div id="reader-container" className="w-full h-full pointer-events-none" />

        {/* Not Found / Overlay */}
        {!isScanning && (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4 animate-in fade-in duration-500">
                 <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/5 shadow-inner">
                    <Camera className="text-white/20" size={48} />
                 </div>
                 <div className="space-y-1">
                    <h4 className="text-lg font-black text-white/40 uppercase italic tracking-tighter">Sensor en Espera</h4>
                    <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] leading-relaxed">
                        Toque el visor para activar Aegis
                    </p>
                 </div>
             </div>
        )}

        {/* Flash de Éxito */}
        {successFlash && (
          <div className="absolute inset-0 z-50 bg-primary/40 animate-in fade-in duration-100" />
        )}

        {/* Marcador Táctico */}
        {isScanning && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div className="w-[85%] h-[85%] border-2 border-white/5 rounded-[2rem] relative border-dashed">
                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-2xl shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-2xl shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-2xl shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-2xl shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary/50 animate-scan blur-[1px]" />
            </div>
          </div>
        )}

        <style>{`
          @keyframes scan {
            0% { top: 10%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 90%; opacity: 0; }
          }
          .animate-scan {
            animation: scan 3s ease-in-out infinite;
            position: absolute;
          }
          #reader-container video { 
            border-radius: 2.5rem; 
            object-fit: contain !important; 
            background: black;
          }
          #reader-container {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
    </div>
  );
});
