import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { Boton } from '../components/ui/Boton';
import { Input } from '../components/ui/Input';
import { 
  ShieldCheck, 
  Fingerprint,
  ArrowRight,
  User as UserIcon,
  Lock,
  ChevronLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export default function Login() {
  const [step, setStep] = useState(1); // 1: Usuario, 2: Autenticación
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState('password'); // 'biometric' | 'password'
  const [hasBiometrics, setHasBiometrics] = useState(false);
  
  const [errorLocal, setErrorLocal] = useState('');
  const [rememberAccount, setRememberAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login, loginBiometrico, verificarBiometria } = useAuthStore();
  const navigate = useNavigate();

  // Cargar cédula recordada al montar
  useEffect(() => {
    const savedCedula = localStorage.getItem('remembered_cedula');
    if (savedCedula) {
      setCedula(savedCedula);
      setRememberAccount(true);
    }
  }, []);

  const handleNextStep = async (e) => {
    if (e) e.preventDefault();
    if (!cedula.trim()) {
      toast.error('Ingresa tu usuario');
      return;
    }

    setLoading(true);
    setErrorLocal('');
    try {
      const isAvailable = await verificarBiometria(cedula.trim());
      setHasBiometrics(isAvailable);
      setAuthMethod(isAvailable ? 'biometric' : 'password');
      setStep(2);
    } catch (err) {
      setHasBiometrics(false);
      setAuthMethod('password');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginBiometrico = async () => {
    setLoading(true);
    setErrorLocal('');
    try {
      const result = await loginBiometrico(cedula.trim());
      if (result === true) {
        navigate('/');
        toast.success('Acceso biométrico concedido');
      } else if (result?.cancelado) {
        // No mostrar error si el usuario canceló
        console.log("BAGFM: Login biométrico cancelado");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Fallo en biometría.';
      setErrorLocal(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginPassword = async (e) => {
    e.preventDefault();
    setErrorLocal('');
    
    if (!password) {
      setErrorLocal('Ingresa tu contraseña');
      return;
    }

    setLoading(true);
    try {
      await login(cedula.trim(), password.trim());
      
      if (rememberAccount) {
        localStorage.setItem('remembered_cedula', cedula.trim());
      } else {
        localStorage.removeItem('remembered_cedula');
      }

      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error de credenciales.';
      setErrorLocal(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app flex flex-col justify-center px-6 antialiased transition-colors duration-500">
      <ThemeToggle />
      
      <div className="w-full max-w-sm mx-auto">
        {/* LOGO SIMULADO */}
        <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex flex-col items-center justify-center mb-4 shadow-[0_0_40px_rgba(78,222,163,0.25)] border border-text-main/10 group">
            <ShieldCheck size={32} color="#003824" strokeWidth={2} className="group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight text-text-main uppercase italic">BAGFM</h1>
          <p className="text-primary tracking-[0.3em] text-[10px] font-black uppercase mt-1 opacity-80">Control Táctico</p>
        </div>

        {/* CARTA DE LOGIN */}
        <div className="bg-bg-modal border border-text-main/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Acento decorativo */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          
          <div className="relative z-10">
            {step === 1 ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="font-display font-bold text-text-main text-lg mb-2 text-center uppercase tracking-tight">Identificación</h2>
                <p className="text-[10px] text-text-muted text-center uppercase font-bold tracking-widest mb-8 opacity-60">Acceso al Sistema Central</p>
                
                <form onSubmit={handleNextStep} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Usuario</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input 
                        type="text"
                        placeholder="Ingresa tu cédula"
                        className="w-full h-14 bg-bg-low/50 border border-text-main/10 focus:border-primary rounded-xl pl-12 pr-4 text-sm font-bold text-text-main transition-all placeholder:text-text-muted/30"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <input 
                      id="remember"
                      type="checkbox" 
                      className="w-4 h-4 rounded border-text-main/10 bg-bg-app text-primary focus:ring-primary accent-primary"
                      checked={rememberAccount}
                      onChange={(e) => setRememberAccount(e.target.checked)}
                    />
                    <label htmlFor="remember" className="text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer select-none opacity-70">
                      Recordar mi usuario
                    </label>
                  </div>

                  <Boton 
                    type="submit" 
                    className="w-full h-14 bg-primary text-bg-app font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 group shadow-lg shadow-primary/20"
                    isLoading={loading}
                  >
                    Continuar
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Boton>
                </form>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <button 
                  onClick={() => setStep(1)}
                  className="absolute -top-2 -left-2 p-2 text-text-muted hover:text-text-main transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-full bg-text-main/5 flex items-center justify-center mx-auto mb-3 border border-text-main/10">
                    <UserIcon size={20} className="text-primary/70" />
                  </div>
                  <h3 className="text-sm font-bold text-text-main uppercase tracking-tight">{cedula}</h3>
                  <p className="text-[9px] text-primary font-black uppercase tracking-widest mt-1 opacity-60">Personal Autorizado</p>
                </div>

                {authMethod === 'biometric' ? (
                  <div className="space-y-6">
                    <Boton 
                      type="button"
                      className="w-full h-14 bg-primary text-bg-app font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 transition-all group shadow-lg shadow-primary/20"
                      onClick={handleLoginBiometrico}
                      isLoading={loading}
                    >
                      <Fingerprint size={20} className="group-hover:scale-110 transition-transform" />
                      Acceso Biométrico
                    </Boton>
                    
                    <button 
                      onClick={() => setAuthMethod('password')}
                      className="w-full py-2 text-[10px] font-black text-text-muted hover:text-text-main uppercase tracking-[0.2em] transition-colors"
                    >
                      O usar mi contraseña
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLoginPassword} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input 
                          type="password"
                          placeholder="••••••••"
                          className="w-full h-14 bg-bg-low/50 border border-text-main/10 focus:border-primary rounded-xl pl-12 pr-4 text-sm font-bold text-text-main transition-all placeholder:text-text-muted/30"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={loading}
                          autoFocus
                        />
                      </div>
                    </div>

                    <Boton 
                      type="submit" 
                      className="w-full h-14 bg-primary text-bg-app font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                      isLoading={loading}
                    >
                      Iniciar Sesión
                    </Boton>

                    {hasBiometrics && (
                      <button 
                        type="button"
                        onClick={() => setAuthMethod('biometric')}
                        className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-primary hover:brightness-125 uppercase tracking-[0.2em] transition-all"
                      >
                        <Fingerprint size={14} />
                        Usar Biometría
                      </button>
                    )}
                  </form>
                )}
              </div>
            )}
            
            {errorLocal && (
              <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-2xl animate-shake">
                <p className="text-[9px] text-danger font-black uppercase tracking-[0.15em] text-center leading-relaxed">
                  {errorLocal}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <p className="text-center text-text-muted mt-8 text-[9px] font-black uppercase tracking-[0.3em] opacity-30">
          BAGFM • Sistema Táctico de Acceso
        </p>
      </div>
    </div>
  );
}
