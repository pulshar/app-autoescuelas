import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import type { Booking, AppSettings } from '../types.ts';
import {
  Calendar,
  Clock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  CalendarPlus,
  Car,
  ChevronRight,
  Ban,
  Phone,
  Compass,
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
}

export default function StudentDashboard({ onNavigate }: StudentDashboardProps) {
  const { user } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bookingsRes, settingsRes] = await Promise.all([
        api.getBookings({ student_id: user?.id, status: 'Reservada' }),
        api.getSettings(),
      ]);

      // Filter upcoming bookings
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const upcoming = bookingsRes.bookings
        .filter(b => {
          if (b.status !== 'Reservada') return false;
          if (b.date < todayStr) return false;
          if (b.date === todayStr && b.end_time <= currentTime) return false;
          return true;
        })
        .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)));

      setUpcomingBookings(upcoming);
      setSettings(settingsRes.settings);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const nextBooking = upcomingBookings[0] || null;
  console.log(nextBooking);

  // Check if student can cancel next booking based on settings.min_cancellation_hours
  const canCancelBooking = (booking: Booking): { allowed: boolean; hoursRemaining: number } => {
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

  const handleCancel = async (bookingId: string) => {
    setCancelError(null);
    setCancelSuccess(null);
    try {
      const res = await api.cancelBooking(bookingId, cancelReason);
      setCancelSuccess(res.message);
      setCancellingId(null);
      setCancelReason('');
      fetchData();
    } catch (err: any) {
      setCancelError(err.message || 'No se pudo cancelar la reserva.');
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatted = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };


  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Greeting Banner */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-indigo-600">Área del Alumno</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            ¡Hola, {user?.name.split(' ')[0]}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestiona tus clases prácticas de conducir y reserva tus próximos horarios fácilmente.
          </p>
        </div>

        <button
          onClick={() => onNavigate('book')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shrink-0"
        >
          <CalendarPlus className="w-5 h-5" />
          <span>Reservar nueva clase</span>
        </button>
      </div>

      {cancelSuccess && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{cancelSuccess}</span>
        </div>
      )}

      {cancelError && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{cancelError}</span>
        </div>
      )}

      {/* SECTION 25: PROMINENT "PRÓXIMA CLASE" CARD */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-indigo-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Car className="w-3.5 h-3.5" /> Próxima clase
            </span>
            {nextBooking && (
              <span className="text-xs text-indigo-200 font-medium">
                Duración: <strong className="text-white font-bold">{nextBooking.duration_minutes} minutos</strong>
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center text-indigo-200 text-sm animate-pulse">
              Cargando tu próxima clase...
            </div>
          ) : nextBooking ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Date & Time */}
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white">
                    {formatDate(nextBooking.date)}
                  </h3>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 text-white font-bold text-sm sm:text-base backdrop-blur-xs border border-white/10">
                      <Clock className="w-4 h-4 text-indigo-300" />
                      <span>{nextBooking.start_time} - {nextBooking.end_time}</span>
                    </div>
                    <span className="text-xs text-indigo-200">
                      ({nextBooking.duration_minutes} min)
                    </span>
                  </div>
                </div>

                {/* Instructor Card info */}
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/10 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-indigo-700/80 flex items-center justify-center text-xl font-bold text-white border border-indigo-400/30 overflow-hidden shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-indigo-300 block">
                      Profesor Asignado
                    </span>
                    <h4 className="font-bold text-base text-white">{nextBooking.teacher_name}</h4>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Next Booking */}
              <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-indigo-200 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-indigo-300 shrink-0" />
                  <span>Punto de encuentro: Puerta principal de la autoescuela</span>
                </div>

                {/* Cancel check */}
                {(() => {
                  const { allowed, hoursRemaining } = canCancelBooking(nextBooking);
                  return (
                    <div className="flex items-center gap-3">
                      {allowed ? (
                        <button
                          onClick={() => setCancellingId(nextBooking.id)}
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 border border-rose-400/30 transition-colors"
                        >
                          Cancelar esta clase
                        </button>
                      ) : (
                        <span className="text-[11px] text-amber-300/90 font-medium">
                          No cancelable (&lt;{settings?.min_cancellation_hours}h antes)
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-indigo-200 text-sm mb-4">
                No tienes ninguna clase programada próximamente.
              </p>
              <button
                onClick={() => onNavigate('book')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-indigo-900 font-bold text-xs sm:text-sm hover:bg-indigo-50 shadow-md transition-colors"
              >
                <CalendarPlus className="w-4 h-4" /> Reservar ahora mi siguiente clase
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancellingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" /> Cancelar reserva
            </h4>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              ¿Estás seguro de que deseas cancelar esta clase? El slot volverá a quedar disponible para otros alumnos.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo de la cancelación (opcional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ej. Imprevisto de horario laboral..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCancellingId(null);
                  setCancelReason('');
                }}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => handleCancel(cancellingId)}
                className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700  transition-colors"
              >
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 25: RESUMEN DE PRÓXIMAS RESERVAS */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-slate-900">Tus próximas reservas</h3>
          <button
            onClick={() => onNavigate('my-classes')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Ver todas ({upcomingBookings.length}) <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {upcomingBookings.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No tienes clases pendientes en este momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingBookings.slice(0, 4).map(booking => (
              <div key={booking.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs sm:text-sm text-slate-900">
                      {formatDate(booking.date)}
                    </h5>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-700">
                        {booking.start_time} - {booking.end_time}
                      </span>
                      <span>•</span>
                      <span>Prof. {booking.teacher_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
