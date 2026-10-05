import { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useStudentBookings } from '../hooks/useStudentBookings.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import { Button } from './common/Button.tsx';
import { StatusBadge } from './common/StatusBadge.tsx';
import { Modal } from './common/Modal.tsx';
import type { Booking } from '../types.ts';
import {
  Calendar,
  Clock,
  User,
  Ban,
  CalendarPlus,
  Info,
} from 'lucide-react';

interface MyClassesProps {
  onNavigateToBook: () => void;
}

export default function MyClasses({ onNavigateToBook }: MyClassesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const {
    upcomingBookings,
    historyBookings,
    settings,
    loading,
    cancelBooking,
    canCancel,
  } = useStudentBookings(user?.id);

  // Cancellation modal state
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const displayedList = activeTab === 'upcoming' ? upcomingBookings : historyBookings;

  const handleExecuteCancel = async () => {
    if (!cancellingBooking) return;
    setCancelLoading(true);

    try {
      const res = await cancelBooking(cancellingBooking.id, cancelReason);

      toast(
        res.message || 'Clase cancelada correctamente.',
        'success'
      );

      setCancellingBooking(null);
      setCancelReason('');
    } catch (err: any) {
      toast(
        err.message || 'Error al cancelar la clase.',
        'error'
      );
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatted = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <div className="space-y-6 pb-12" data-testid="my-classes-page">
      {/* Header & Tabs */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Mis clases de conducir</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consulta tus clases programadas y el registro histórico de prácticas.
          </p>
        </div>

        <Button
          onClick={onNavigateToBook}
          data-testid="my-classes-book-btn"
          leftIcon={<CalendarPlus className="w-4 h-4" />}
          className="shrink-0"
        >
          Reservar clase
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          data-testid="my-classes-upcoming-tab"
          className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'upcoming' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Próximas clases ({upcomingBookings.length})
          {activeTab === 'upcoming' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          data-testid="my-classes-history-tab"
          className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'history' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Histórico ({historyBookings.length})
          {activeTab === 'history' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
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
            <Button
              onClick={onNavigateToBook}
              data-testid="my-classes-empty-book-btn"
              leftIcon={<CalendarPlus className="w-4 h-4" />}
              size="sm"
              className="mt-5"
            >
              Reservar ahora
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map((booking: Booking) => {
            const { allowed } = canCancel(booking);
            const isCancellable = activeTab === 'upcoming' && !booking.status.startsWith('Cancelada');

            return (
              <div
                key={booking.id}
                data-testid={`booking-card-${booking.id}`}
                className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="hidden sm:flex w-12 h-12 rounded-xl bg-brand-50 text-brand-700 items-center justify-center font-bold text-xs shrink-0">
                        <Calendar className="w-5 h-5 text-brand-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate"> {formatDate(booking.date)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-sm text-slate-600 mt-1">
                          <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span className="font-semibold text-slate-800 whitespace-nowrap">
                            {booking.start_time} - {booking.end_time}
                          </span>
                          <span className="text-slate-500 whitespace-nowrap">
                            ({booking.duration_minutes} min)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className='text-center'>
                      <StatusBadge status={booking.status} />
                    </div>
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
                        data-testid={`cancel-btn-${booking.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                      >
                        <Ban className="w-4 h-4" /> Cancelar
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
      <Modal
        isOpen={Boolean(cancellingBooking)}
        onClose={() => {
          setCancellingBooking(null);
          setCancelReason('');
        }}
        title="Cancelar reserva de clase"
        testId="myclasses-cancel-modal"
      >
        {cancellingBooking && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              ¿Confirmas la cancelación de la clase del{' '}
              <strong>{formatDisplayDate(cancellingBooking.date)}</strong> a las{' '}
              <strong>{cancellingBooking.start_time}</strong> con el profesor{' '}
              <strong>{cancellingBooking.teacher_name}</strong>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. Imprevisto personal..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="modal"
                onClick={() => {
                  setCancellingBooking(null);
                  setCancelReason('');
                }}
              >
                Volver
              </Button>
              <Button
                variant="danger"
                size="modal"
                isLoading={cancelLoading}
                onClick={handleExecuteCancel}
                data-testid="myclasses-confirm-cancel-btn"
              >
                Confirmar cancelación
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
