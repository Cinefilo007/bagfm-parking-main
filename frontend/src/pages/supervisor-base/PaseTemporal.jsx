import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { ShieldAlert, QrCode } from 'lucide-react';
import supervisorBaseService from '../../services/supervisorBase.service';
import { toast } from 'react-hot-toast';

const PaseTemporal = () => {
    const [formData, setFormData] = useState({
        cedula: '',
        nombre: '',
        placa: '',
        motivo: '',
        zona_id: ''
    });
    const [zonas, setZonas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatedPass, setGeneratedPass] = useState(null);

    useEffect(() => {
        const fetchZonas = async () => {
            try {
                const data = await supervisorBaseService.getSituacion();
                setZonas(data.zonas_estacionamiento || []);
            } catch (error) {}
        };
        fetchZonas();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await supervisorBaseService.generarPaseTemporal(formData);
            setGeneratedPass(res);
            toast.success("Pase de seguridad generado");
        } catch (error) {
            toast.error(error.response?.data?.detail || "Error al generar pase");
        } finally {
            setLoading(false);
        }
    };

    if (generatedPass) {
        return (
            <div className="p-6 max-w-xl mx-auto flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="p-8 bg-white rounded-[40px] shadow-2xl">
                    <QrCode size={240} className="text-bg-app" />
                </div>
                <div className="text-center space-y-3">
                    <h3 className="text-3xl font-black text-text-main uppercase tracking-tighter">Pase de Emergencia</h3>
                    <p className="text-sm font-bold text-text-muted uppercase tracking-[0.2em]">Válido por 24 horas // Autorización Sentinel</p>
                    <div className="pt-6 flex flex-col gap-3">
                        <div className="px-6 py-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary font-black uppercase text-sm tracking-widest">
                            Token: {generatedPass.token_evento}
                        </div>
                        <Boton onClick={() => setGeneratedPass(null)} variant="ghost" className="text-[10px] font-black uppercase tracking-[0.3em] py-4">
                            Emitir Nueva Autorización
                        </Boton>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-black text-text-main uppercase tracking-tight italic">
                    Emisión de Pases de Emergencia
                </h1>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">
                    Autorización Directa para Casos Excepcionales
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 bg-bg-card/20 p-6 md:p-10 rounded-[32px] border border-white/5">
                <div className="p-5 bg-amber-400/10 border border-amber-400/20 rounded-2xl flex items-start gap-4">
                    <ShieldAlert size={24} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest">Protocolo de Emisión Directa</p>
                        <p className="text-[10px] text-amber-400/70 font-bold uppercase leading-relaxed mt-1">
                            Este pase elude los controles administrativos convencionales. Se utiliza exclusivamente para interrogación en campo, emergencias médicas o visitas de alto mando. Cada emisión queda registrada en la bitácora de auditoría del Comandante.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Cédula del Portador</label>
                        <input
                            className="w-full h-14 bg-bg-card/40 border border-white/10 rounded-2xl px-5 text-sm font-bold text-text-main outline-none focus:ring-1 focus:ring-primary uppercase transition-all"
                            required
                            placeholder="V-00000000"
                            value={formData.cedula}
                            onChange={(e) => setFormData({...formData, cedula: e.target.value.toUpperCase()})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Nombre Completo</label>
                        <input
                            className="w-full h-14 bg-bg-card/40 border border-white/10 rounded-2xl px-5 text-sm font-bold text-text-main outline-none focus:ring-1 focus:ring-primary uppercase transition-all"
                            required
                            placeholder="EJ: JUAN PEREZ"
                            value={formData.nombre}
                            onChange={(e) => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Placa Vehículo</label>
                        <input
                            className="w-full h-14 bg-bg-card/40 border border-white/10 rounded-2xl px-5 text-sm font-bold text-text-main outline-none focus:ring-1 focus:ring-primary uppercase transition-all"
                            required
                            placeholder="ABC123D"
                            value={formData.placa}
                            onChange={(e) => setFormData({...formData, placa: e.target.value.toUpperCase()})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Motivo / Caso</label>
                        <input
                            className="w-full h-14 bg-bg-card/40 border border-white/10 rounded-2xl px-5 text-sm font-bold text-text-main outline-none focus:ring-1 focus:ring-primary uppercase transition-all"
                            required
                            placeholder="EJ: EMERGENCIA MÉDICA"
                            value={formData.motivo}
                            onChange={(e) => setFormData({...formData, motivo: e.target.value.toUpperCase()})}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Zona Asignada</label>
                        <select
                            className="w-full h-14 bg-bg-card/40 border border-white/10 rounded-2xl px-5 text-sm font-bold text-text-main outline-none focus:ring-1 focus:ring-primary uppercase transition-all appearance-none cursor-pointer"
                            required
                            value={formData.zona_id}
                            onChange={(e) => setFormData({...formData, zona_id: e.target.value})}
                        >
                            <option value="">SELECCIONAR UBICACIÓN TÁCTICA...</option>
                            {zonas.map(z => (
                                <option key={z.id} value={z.id}>{z.nombre} (Libres: {z.capacidad_total - (z.ocupacion_actual || 0)})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <Boton 
                    type="submit" 
                    isLoading={loading}
                    className="w-full h-16 bg-primary text-bg-app font-black uppercase tracking-[0.3em] shadow-tactica rounded-2xl"
                >
                    Autorizar Ingreso Excepcional
                </Boton>
            </form>
        </div>
    );
};

export default PaseTemporal;
