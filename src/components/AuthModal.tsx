import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import {
  X,
  LogIn,
  UserPlus,
  KeyRound,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { Button } from './common/Button.tsx';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  initialEmail?: string;
  initialResetToken?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  initialEmail = '',
  initialResetToken = '',
}: AuthModalProps) {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);

  // Login/Register Form State
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Password Recovery State
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialMode) setMode(initialMode);
      if (initialEmail) setEmail(initialEmail);
      if (initialResetToken) setResetToken(initialResetToken);
      setError(null);
      setSuccessMessage(null);
      setForgotEmailSent(false);
    }
  }, [isOpen, initialMode, initialEmail, initialResetToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password.trim());
        onClose();
      } else if (mode === 'register') {
        await register(email.trim().toLowerCase(), password.trim(), name.trim(), phone.trim());
        onClose();
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Introduce tu correo electrónico.');
          setLoading(false);
          return;
        }
        const res = await api.forgotPassword(email.trim());
        setSentToEmail(email.trim());
        setForgotEmailSent(true);
        setSuccessMessage(res.message);
      } else if (mode === 'reset') {
        if (!resetToken.trim()) {
          setError('El código o token de recuperación es obligatorio.');
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setError('La nueva contraseña debe tener al menos 6 caracteres.');
          setLoading(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('Las contraseñas no coinciden. Asegúrate de escribir la misma en ambos campos.');
          setLoading(false);
          return;
        }

        const res = await api.resetPassword({ token: resetToken.trim(), newPassword });
        setSuccessMessage(res.message);
        setTimeout(() => {
          setMode('login');
          setNewPassword('');
          setConfirmPassword('');
          setResetToken('');
        }, 2200);
      }
    } catch (err: any) {
      setError(err.message || 'Error en la solicitud. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth flow
  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
    >
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-100 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 cursor-default">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center">
          <h3 className="text-xl font-bold text-slate-900">
            {mode === 'login' && 'Iniciar sesión'}
            {mode === 'register' && 'Crear cuenta de alumno'}
            {mode === 'forgot' && 'Recuperar contraseña'}
            {mode === 'reset' && 'Nueva contraseña'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login' && 'Accede a tu agenda y reservas de clases de conducir'}
            {mode === 'register' && 'Regístrate para reservar tus clases online'}
            {mode === 'forgot' && 'Te enviaremos las instrucciones de recuperación'}
            {mode === 'reset' && 'Introduce el código recibido por email y tu nueva contraseña'}
          </p>
        </div>

        <div className="p-6">
          {/* Notifications / Alerts */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && !forgotEmailSent && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Special State: Forgot password email confirmation card */}
          {mode === 'forgot' && forgotEmailSent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-100 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Si tu correo electrónico está registrado recibirás un mensaje con el enlace para restablecer tu contraseña.
                </p>
                <div className="bg-white/80 rounded-xl p-3 text-[11px] text-slate-500 space-y-1 text-left border border-brand-50">
                  <p className="flex items-center gap-1.5 font-medium text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Revisa tu bandeja de entrada y correo no deseado (spam).
                  </p>
                  <p className="flex items-center gap-1.5 font-medium text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> El enlace caduca por seguridad en <strong>1 hora</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  size="md"
                  leftIcon={<KeyRound className="w-4 h-4" />}
                  className="w-full"
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                  }}
                >
                  Introducir código manualmente
                </Button>
              </div>
            </div>
          ) : (
            /* Standard Forms */
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre y Apellidos</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ej. Carlos Ruiz"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono móvil</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Ej. +34 600 000 000"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </>
              )}

              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Contraseña</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setSuccessMessage(null);
                          setForgotEmailSent(false);
                          setError(null);
                        }}
                        className="text-[11px] text-brand-600 hover:text-brand-800 font-medium"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Token de recuperación</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={e => setResetToken(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nueva Contraseña</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </>
              )}
              <Button
                type="submit"
                size="md"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span>Procesando...</span>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" /> Iniciar sesión
                  </>
                ) : mode === 'register' ? (
                  <>
                    <UserPlus className="w-4 h-4" /> Registrarme
                  </>
                ) : mode === 'forgot' ? (
                  <>
                    <KeyRound className="w-4 h-4" /> Enviar instrucciones
                  </>
                ) : (
                  'Restablecer contraseña'
                )}
              </Button>
            </form>
          )}
          {/* Google OAuth Button */}
          {mode === 'login' && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-slate-400">
                  <span className="bg-white px-2">o continúa con</span>
                </div>
              </div>
              <Button
                onClick={handleGoogleSignIn}
                size="md"
                variant='outline'
                className="w-full"
                disabled={loading}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continuar con Google
              </Button>
            </>
          )}

          {/* Toggle Login/Register footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
            {mode === 'login' ? (
              <p>
                ¿No tienes cuenta aún?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setSuccessMessage(null);
                    setError(null);
                  }}
                  className="text-brand-600 hover:text-brand-800 font-semibold"
                >
                  Regístrate como alumno
                </button>
              </p>
            ) : (
              <p>
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setSuccessMessage(null);
                    setError(null);
                  }}
                  className="text-brand-600 hover:text-brand-800 font-semibold"
                >
                  Inicia sesión
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
