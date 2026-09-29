import { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useStudentBookings } from '../hooks/useStudentBookings.ts';
import { Button } from './common/Button.tsx';
import { StatusBadge } from './common/StatusBadge.tsx';
import { Modal } from './common/Modal.tsx';
import type { Booking } from '../types.ts';
import {
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  CalendarPlus,
  Car,
  ChevronRight,
  Ban,
  Compass,
  X,
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
}

export default function StudentDashboard({ onNavigate }: StudentDashboardProps) {
  const { user } = useAuth();
  const {
    upcomingBookings,
    settings,
    loading,
    refresh,
    cancelBooking,
    canCancel,
  } = useStudentBookings(user?.id);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const nextBooking = upcomingBookings[0] || null;

  const handleCancel = async (bookingId: string) => {
    setCancelError(null);
    setCancelSuccess(null);
    setIsCancelling(true);
    try {
      const res = await cancelBooking(bookingId, cancelReason);
      setCancelSuccess(res.message);
      setCancellingId(null);
      setCancelReason('');
    } catch (err: any) {
      setCancelError(err.message || 'No se pudo cancelar la reserva.');
    } finally {
      setIsCancelling(false);
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
    <div className="space-y-6 pb-12" data-testid="student-dashboard">
      {/* Welcome Greeting Banner */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-brand-600">Área del Alumno</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            ¡Hola, {user?.name.split(' ')[0]}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestiona tus clases prácticas de conducir y reserva tus próximos horarios fácilmente.
          </p>
        </div>

        <Button
          onClick={() => onNavigate('book')}
          data-testid="student-dashboard-book-btn"
          leftIcon={<CalendarPlus className="w-4 h-4" />}
          className="shrink-0"
        >
          Reservar nueva clase
        </Button>
      </div>

      {cancelSuccess && (
        <div className="p-3.5 rounded-lg text-xs sm:text-sm flex items-center justify-between gap-2 transition-all bg-emerald-50 border border-emerald-200 text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{cancelSuccess}</span>
          </div>
          <button onClick={() => setCancelSuccess(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {cancelError && (
        <div className="p-3.5 rounded-lg text-xs sm:text-sm flex items-center justify-between gap-2 transition-all bg-rose-50 border border-rose-200 text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{cancelError}</span>
          </div>
          <button onClick={() => setCancelError(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PROMINENT "PRÓXIMA CLASE" CARD */}
      <div className="bg-gradient-to-br from-brand-900 via-slate-900 to-brand-950 text-white rounded-xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-64 h-64 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-brand-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-400/30">
              <Car className="w-3.5 h-3.5" /> Próxima clase
            </span>
            {nextBooking && (
              <span className="text-xs text-brand-200 font-medium">
                Duración: <strong className="text-white font-bold">{nextBooking.duration_minutes} minutos</strong>
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center text-brand-200 text-sm animate-pulse">
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
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 text-white font-bold text-sm sm:text-base backdrop-blur-xs border border-white/10">
                      <Clock className="w-4 h-4 text-brand-300" />
                      <span>{nextBooking.start_time} - {nextBooking.end_time}</span>
                    </div>
                    <span className="text-xs text-brand-200">
                      ({nextBooking.duration_minutes} min)
                    </span>
                  </div>
                </div>

                {/* Instructor Card info */}
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/10 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-brand-700/80 flex items-center justify-center text-xl font-bold text-white border border-brand-400/30 overflow-hidden shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-brand-300 block">
                      Profesor Asignado
                    </span>
                    <h4 className="font-bold text-base text-white">{nextBooking.teacher_name}</h4>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Next Booking */}
              <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-brand-200 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-brand-300 shrink-0" />
                  <span>Punto de encuentro: Puerta principal de la autoescuela</span>
                </div>

                {/* Cancel check */}
                {(() => {
                  const { allowed } = canCancel(nextBooking);
                  return (
                    <div className="flex items-center gap-3">
                      {allowed ? (
                        <button
                          onClick={() => setCancellingId(nextBooking.id)}
                          data-testid="student-dashboard-cancel-class-btn"
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
              <p className="text-brand-200 text-sm mb-4">
                No tienes ninguna clase programada próximamente.
              </p>
              <Button
                onClick={() => onNavigate('book')}
                data-testid="student-dashboard-empty-book-btn"
                leftIcon={<CalendarPlus className="w-4 h-4" />}
                className="shrink-0"
                variant='secondary'
              >
                Reservar ahora mi siguiente clase
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancellingId)}
        onClose={() => {
          setCancellingId(null);
          setCancelReason('');
        }}
        title="Cancelar reserva de clase"
        testId="cancel-booking-modal"
      >
        <p className="text-xs text-slate-500 leading-relaxed">
          ¿Estás seguro de que deseas cancelar esta clase? El slot volverá a quedar disponible para otros alumnos.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Motivo de la cancelación (opcional)
          </label>
          <textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ej. Imprevisto de horario laboral..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="modal"
            onClick={() => {
              setCancellingId(null);
              setCancelReason('');
            }}
          >
            Volver
          </Button>
          <Button
            variant="danger"
            size="modal"
            isLoading={isCancelling}
            onClick={() => cancellingId && handleCancel(cancellingId)}
            data-testid="confirm-cancel-btn"
          >
            Confirmar cancelación
          </Button>
        </div>
      </Modal>

      {/* RESUMEN DE PRÓXIMAS RESERVAS */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-slate-900">Tus próximas reservas</h3>
          <button
            onClick={() => onNavigate('my-classes')}
            data-testid="student-dashboard-view-all-classes-btn"
            className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
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
            {upcomingBookings.slice(0, 4).map((booking: Booking) => (
              <div key={booking.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Calendar className="w-5 h-5 text-brand-600" />
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

                <div>
                  <StatusBadge status={booking.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
