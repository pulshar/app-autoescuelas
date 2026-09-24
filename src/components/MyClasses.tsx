import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { Booking, AppSettings } from '../types.ts';
import {
  Calendar,
  Clock,
  User,
  Ban,
  AlertCircle,
  CheckCircle2,
  CalendarPlus,
  ArrowRight,
  Info,
} from 'lucide-react';

interface MyClassesProps {
  onNavigateToBook: () => void;
}

export default function MyClasses({ onNavigateToBook }: MyClassesProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Cancellation modal state
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const [bRes, sRes] = await Promise.all([
        api.getBookings({ student_id: user?.id }),
        api.getSettings(),
      ]);
      setBookings(bRes.bookings);
      setSettings(sRes.settings);
    } catch (err: any) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const todayStr = new Date().toISOString().split('T')[0];

  const upcomingClasses = bookings.filter(
    b => b.date >= todayStr && !b.status.startsWith('Cancelada') && b.status !== 'Completada'
  );

  const historyClasses = bookings.filter(
    b => b.date < todayStr || b.status.startsWith('Cancelada') || b.status === 'Completada'
  );

  const displayedList = activeTab === 'upcoming' ? upcomingClasses : historyClasses;

  // Check cancellation eligibility
  const canCancel = (booking: Booking): { allowed: boolean; hoursRemaining: number } => {
    if (!settings) return { allowed: true, hoursRemaining: 99 };
    const [year, month, day] = booking.date.split('-').map(Number);
    const [hour, min] = booking.start_time.split(':').map(Number);
    const bookingDate = new Date(year, month - 1, day, hour, min);
    const now = new Date();
    const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 3600);
    return {
      allowed: diffHours >= settings.min_cancellation_hours,
      hoursRemaining: Math.max(0, Math.round(diffHours)),
    };
  };

  const handleExecuteCancel = async () => {
    if (!cancellingBooking) return;
    setCancelLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.cancelBooking(cancellingBooking.id, cancelReason);
      setSuccessMessage(res.message);
      setCancellingBooking(null);
      setCancelReason('');
      fetchBookings();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cancelar la clase.');
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Reservada':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Reservada
          </span>
        );
      case 'Confirmada':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Confirmada
          </span>
        );
      case 'Completada':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Completada
          </span>
        );
      case 'Cancelada por alumno':
      case 'Cancelada por administrador':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            {status}
          </span>
        );
      case 'No presentado':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            No presentado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Mis Clases de Conducir</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consulta tus clases programadas y el registro histórico de prácticas.
          </p>
        </div>

        <button
          onClick={onNavigateToBook}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
        >
          <CalendarPlus className="w-4 h-4" /> Reservar Clase
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'upcoming'
            ? 'text-indigo-600'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Próximas Clases ({upcomingClasses.length})
          {activeTab === 'upcoming' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'history'
            ? 'text-indigo-600'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Historial Pasado ({historyClasses.length})
          {activeTab === 'history' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Classes List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
          Cargando tus clases...
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">
            {activeTab === 'upcoming' ? 'No tienes próximas clases' : 'Sin clases en el historial'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'upcoming'
              ? 'Explora los horarios disponibles de nuestros profesores y asegura tu plaza para tu siguiente práctica.'
              : 'Aquí aparecerán las clases que vayas completando o cancelando.'}
          </p>
          {activeTab === 'upcoming' && (
            <button
              onClick={onNavigateToBook}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              <CalendarPlus className="w-4 h-4" /> Reservar ahora
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map(booking => {
            const { allowed, hoursRemaining } = canCancel(booking);
            const isCancellable = activeTab === 'upcoming' && !booking.status.startsWith('Cancelada');

            return (
              <div
                key={booking.id}
                className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 capitalize">
                          {formatDate(booking.date)}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-semibold text-slate-800">
                            {booking.start_time} - {booking.end_time}
                          </span>
                          <span>({booking.duration_minutes} min)</span>
                        </div>
                      </div>
                    </div>

                    <div>{getStatusBadge(booking.status)}</div>
                  </div>

                  {/* Teacher & Notes */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 mt-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Profesor: <strong>{booking.teacher_name}</strong>
                      </span>
                    </div>

                    {booking.notes && (
                      <p className="text-slate-500 text-[11px] italic pl-6">
                        Nota: {booking.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card footer: Cancel button or reason */}
                {isCancellable && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {allowed ? (
                      <button
                        onClick={() => setCancellingBooking(booking)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                      >
                        <Ban className="w-4 h-4" /> Cancelar reserva
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-700 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> No cancelable (&lt;{settings?.min_cancellation_hours}h antes)
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400">
                      Ref: {booking.id.slice(0, 10)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" /> Cancelar reserva de clase
            </h4>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              ¿Confirmas la cancelación de la clase del{' '}
              <strong>{formatDisplayDate(cancellingBooking.date)}</strong> a las{' '}
              <strong>{cancellingBooking.start_time}</strong> con el profesor{' '}
              <strong>{cancellingBooking.teacher_name}</strong>?
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ej. Imprevisto personal..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingBooking(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={handleExecuteCancel}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors"
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
