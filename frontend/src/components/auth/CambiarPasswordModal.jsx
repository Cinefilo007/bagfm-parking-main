import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { Boton } from '../ui/Boton';
import { useAuthStore } from '../../store/auth.store';
import api from '../../services/api';

export const CambiarPasswordModal = () => {
  const { user, setDebeCambiarPassword } = useAuthStore();
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (nuevaPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (nuevaPassword === user?.cedula) {
      setError('La nueva contraseña debe ser diferente a su cédula');
      return;
    }

    setLoading(true);
    try {
      await api.patch('auth/cambiar-password', { nueva_password: nuevaPassword });
      setSuccess(true);
      setTimeout(() => {
        setDebeCambiarPassword(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-bg-card border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Decoración Táctica */}
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <ShieldAlert size={120} />
        </div>

        {!success ? (
          <>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                <Lock className="text-primary animate-pulse" size={32} />
              </div>
              <h2 className="text-xl font-display font-bold text-text-main uppercase tracking-wider mb-2">
                Seguridad Obligatoria
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Detectamos que estás usando la contraseña por defecto. <br/>
                <span className="text-primary font-bold">Debes actualizarla para continuar.</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nueva Contraseña"
                type="password"
                placeholder="********"
                icon={<Lock size={16} />}
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                required
              />

              <Input
                label="Confirmar Contraseña"
                type="password"
                placeholder="********"
                icon={<ShieldAlert size={16} />}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
              />

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
                  <p className="text-[10px] text-danger text-center font-bold uppercase tracking-widest leading-tight">
                    {error}
                  </p>
                </div>
              )}

              <Boton 
                type="submit" 
                className="w-full h-12 gap-2" 
                isLoading={loading}
              >
                ACTUALIZAR CREDENCIALES
                <ArrowRight size={18} />
              </Boton>
            </form>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="h-20 w-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 border border-primary/30">
              <CheckCircle2 className="text-primary" size={48} />
            </div>
            <h2 className="text-xl font-display font-bold text-text-main uppercase tracking-wider mb-2">
              ¡Acceso Seguro!
            </h2>
            <p className="text-xs text-text-muted">
              Tu contraseña ha sido actualizada. <br/>
              Sincronizando permisos tácticos...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
