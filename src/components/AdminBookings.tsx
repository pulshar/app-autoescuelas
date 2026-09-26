import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { Booking, Teacher, User } from '../types.ts';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  Ban,
  Phone,
  Mail,
  X,
  Edit2,
  Check,
  AlertTriangle,
  UserX,
  ShieldCheck,
} from 'lucide-react';

interface AdminBookingsProps {
  onOpenManualModal: () => void;
}

export default function AdminBookings({ onOpenManualModal }: AdminBookingsProps) {
  const [activeTab, setActiveTab] = useState<'pending_review' | 'upcoming' | 'history'>('pending_review');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Status edit modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Quick Action Modal (e.g. Complete with optional notes or Mark No-Show)
  const [quickActionModal, setQuickActionModal] = useState<{
    booking: Booking;
    type: 'complete' | 'noshow';
    notes: string;
  } | null>(null);

  const [quickActionLoading, setQuickActionLoading] = useState(false);

  // Cancellation modal
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelada directamente por el administrador');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const [bRes, tRes] = await Promise.all([
        api.getBookings(),
        api.getTeachers(),
      ]);
      setBookings(bRes.bookings);
      setTeachers(tRes.teachers);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (!selectedBooking && !cancellingBooking && !quickActionModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBooking(null);
        setCancellingBooking(null);
        setQuickActionModal(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBooking, cancellingBooking, quickActionModal]);

  const handleUpdateStatus = async () => {
    if (!selectedBooking || !newStatus) return;
    setStatusLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await api.updateBookingStatus(selectedBooking.id, newStatus, statusNotes);
      setActionMessage(res.message);
      setTimeout(() => setActionMessage(null), 5000);
      setSelectedBooking(null);
      fetchBookings();
    } catch (err: any) {
      setActionError(err.message || 'Error al actualizar el estado.');
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setStatusLoading(false);
    }
  };

  // Quick Action execution (Mark Complete or Mark No-show)
  const handleExecuteQuickAction = async () => {
    if (!quickActionModal) return;
    setQuickActionLoading(true);
    setActionError(null);
    setActionMessage(null);

    const { booking, type, notes } = quickActionModal;
    const targetStatus = type === 'complete' ? 'Completada' : 'No presentado';
    const finalNotes = notes.trim()
      ? notes.trim()
      : type === 'complete'
        ? (booking.notes ? booking.notes : 'Clase realizada y validada por el administrador')
        : (booking.notes ? `${booking.notes} - No se presentó` : 'El alumno no se presentó a la clase');

    try {
      const res = await api.updateBookingStatus(booking.id, targetStatus, finalNotes);
      setActionMessage(
        type === 'complete'
          ? `Clase de ${booking.student_name} validada como Completada.`
          : `Clase de ${booking.student_name} registrada como No presentado.`
      );
      setTimeout(() => setActionMessage(null), 5000);
      setQuickActionModal(null);
      fetchBookings();
    } catch (err: any) {
      setActionError(err.message || 'Error al actualizar el estado.');
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setQuickActionLoading(false);
    }
  };

  // Cancel booking modal handlers
  const handleOpenCancel = (b: Booking) => {
    setCancellingBooking(b);
    setCancelReason('Cancelada directamente por el administrador');
  };

  const handleCloseCancel = () => {
    setCancellingBooking(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setCancelLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await api.cancelBooking(
        cancellingBooking.id,
        cancelReason.trim() || 'Cancelada directamente por el administrador'
      );
      setActionMessage(res.message || 'Reserva cancelada correctamente.');
      setTimeout(() => setActionMessage(null), 5000);
      handleCloseCancel();
      fetchBookings();
    } catch (err: any) {
      setActionError(err.message || 'Error al cancelar la reserva.');
      setTimeout(() => setActionError(null), 6000);
      handleCloseCancel();
    } finally {
      setCancelLoading(false);
    }
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const isBookingPassed = (b: Booking) => {
    if (b.date < todayStr) return true;
    if (b.date === todayStr && b.end_time <= currentTime) return true;
    return false;
  };
  const isUpcoming = (b: Booking) => {
    if (b.status !== 'Reservada') return false;
    return !isBookingPassed(b);
  };

  // 1. Pending review: passed bookings in 'Pendiente de revisión' (or passed 'Reservada')
  const pendingReviewBookings = bookings
    .filter(b => b.status === 'Pendiente de revisión' || (b.status === 'Reservada' && isBookingPassed(b)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));

  // 2. Upcoming bookings: strictly future and active
  const upcomingBookings = bookings
    .filter(isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  // 3. History bookings: past finalized or cancelled (not in pending review and not upcoming)
  const historyBookings = bookings
    .filter(b => b.status !== 'Pendiente de revisión' && !isUpcoming(b))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));

  // Common filter function for search, teacher, status, and date
  const applyFilters = (list: Booking[]) => {
    return list.filter(b => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          b.student_name?.toLowerCase().includes(q) ||
          b.student_email?.toLowerCase().includes(q) ||
          b.teacher_name?.toLowerCase().includes(q) ||
          b.date.includes(q) ||
          formatDisplayDate(b.date).includes(q);
        if (!match) return false;
      }
      if (filterTeacher && b.teacher_id !== filterTeacher) return false;
      if (filterStatus && b.status !== filterStatus) return false;
      if (filterDate && b.date !== filterDate) return false;
      return true;
    });
  };

  const filteredPending = applyFilters(pendingReviewBookings);
  const filteredUpcoming = applyFilters(upcomingBookings);
  const filteredHistory = applyFilters(historyBookings);

  const hasActiveFilters = Boolean(searchQuery || filterTeacher || filterStatus || filterDate);
  const pendingCount = hasActiveFilters ? filteredPending.length : pendingReviewBookings.length;
  const upcomingCount = hasActiveFilters ? filteredUpcoming.length : upcomingBookings.length;
  const historyCount = hasActiveFilters ? filteredHistory.length : historyBookings.length;

  const displayedBookings =
    activeTab === 'pending_review'
      ? filteredPending
      : activeTab === 'upcoming'
        ? filteredUpcoming
        : filteredHistory;

  const handleTabChange = (tab: 'pending_review' | 'upcoming' | 'history') => {
    setActiveTab(tab);
    setFilterStatus('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pendiente de revisión':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pendiente de revisión</span>;
      case 'Reservada':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Reservada</span>;
      case 'Completada':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Completada</span>;
      case 'Cancelada por alumno':
      case 'Cancelada por administrador':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">{status}</span>;
      case 'No presentado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">No presentado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gestión de reservas</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administra, modifica el estado o cancela reservas de clases prácticas.
          </p>
        </div>

        <button
          onClick={onOpenManualModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold  transition-colors shrink-0"
        >
          <CalendarPlus className="w-4 h-4" /> Nueva reserva
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}


      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar alumno, email, profesor..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Teacher filter */}
          <div>
            <select
              value={filterTeacher}
              onChange={e => setFilterTeacher(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="">Todos los profesores</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="">Todos los estados</option>
              {activeTab === 'pending_review' ? (
                <>
                  <option value="Pendiente de revisión">Pendiente de revisión</option>
                  <option value="Reservada">Reservada (Pasada)</option>
                </>
              ) : activeTab === 'upcoming' ? (
                <option value="Reservada">Reservada</option>
              ) : (
                <>
                  <option value="Completada">Completada</option>
                  <option value="No presentado">No presentado</option>
                  <option value="Cancelada por alumno">Cancelada por alumno</option>
                  <option value="Cancelada por administrador">Cancelada por administrador</option>
                </>
              )}
            </select>
          </div>

          {/* Date filter */}
          <div>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            />
          </div>
        </div>

        {(filterTeacher || filterStatus || filterDate || searchQuery) && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>Resultados filtrados: {displayedBookings.length} reservas</span>
            <button
              onClick={() => {
                setFilterTeacher('');
                setFilterStatus('');
                setFilterDate('');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Booking list} */}
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 gap-4 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => handleTabChange('upcoming')}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === 'upcoming'
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Próximas clases ({upcomingCount})
            {activeTab === 'upcoming' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === 'history'
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Histórico ({historyCount})
            {activeTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('pending_review')}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === 'pending_review'
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <span className="flex items-center gap-1.5">
              Clases por revisar
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${pendingCount > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 text-slate-500'
                }`}
            >
              {pendingCount}
            </span>
            {activeTab === 'pending_review' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Alert banner if on pending_review tab */}
        {activeTab === 'pending_review' && (
          <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm sm:text-base">
                    Clases finalizadas pendientes de revisión
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Confirma si fueron <strong>completadas</strong> o si el alumno <strong>no se presentó</strong>. Si no se revisa en 72 horas, la clase pasará automáticamente a Completada.
                </p>
              </div>
            </div>
          </div>


        )}
        {/* Bookings Table / Cards */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
              Cargando reservas...
            </div>
          ) : displayedBookings.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center p-6">
              <Calendar className="w-10 h-10 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 text-sm">
                {activeTab === 'pending_review'
                  ? hasActiveFilters
                    ? 'No hay clases pendientes de revisión con los filtros actuales.'
                    : '¡Al día! No hay clases pendientes de revisión.'
                  : activeTab === 'upcoming'
                    ? hasActiveFilters
                      ? 'No se encontraron próximas clases con los criterios seleccionados.'
                      : 'No hay próximas clases programadas en este momento.'
                    : hasActiveFilters
                      ? 'No se encontraron clases pasadas con los criterios seleccionados.'
                      : 'No hay clases en el historial pasado.'}
              </p>
              {activeTab === 'pending_review' && !hasActiveFilters && (
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Todas las clases pasadas han sido validadas por el administrador o cerradas tras 72 horas.
                </p>
              )}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setFilterTeacher('');
                    setFilterStatus('');
                    setFilterDate('');
                    setSearchQuery('');
                  }}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayedBookings.map(b => {
                const isPassed = isBookingPassed(b);
                const isPendingReview = b.status === 'Pendiente de revisión' || (isPassed && b.status === 'Reservada');

                return (
                  <div
                    key={b.id}
                    className="p-4 sm:p-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info block */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-bold text-sm text-slate-900">
                          {b.student_name}
                        </span>
                        {getStatusBadge(b.status)}
                        <span className="text-[11px] text-slate-400">ID: {b.id.slice(0, 8)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" /> {formatDisplayDate(b.date)}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" /> {b.start_time} - {b.end_time}{' '}
                          ({b.duration_minutes} min)
                        </span>
                        <span className="flex items-center gap-1 text-slate-700">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Profesor: {b.teacher_name}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                        {b.student_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" /> {b.student_email}
                          </span>
                        )}
                        {b.student_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {b.student_phone}
                          </span>
                        )}
                        {b.notes && (
                          <span className="italic text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            "{b.notes}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      {/* If in pending review: show the two prominent 1-click quick action buttons */}
                      {isPendingReview && (
                        <>
                          <button
                            onClick={() => setQuickActionModal({ booking: b, type: 'complete', notes: b.notes || '' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="Confirmar que la clase se impartió con normalidad"
                          >
                            <Check className="w-3.5 h-3.5" /> Completada
                          </button>

                          <button
                            onClick={() => setQuickActionModal({ booking: b, type: 'noshow', notes: b.notes || '' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                            title="Marcar falta de asistencia del alumno"
                          >
                            <UserX className="w-3.5 h-3.5" /> No presentado
                          </button>
                        </>
                      )}

                      {/* Standard Edit Status Button */}
                      <button
                        onClick={() => {
                          setSelectedBooking(b);
                          setNewStatus(b.status);
                          setStatusNotes(b.notes || '');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Estado
                      </button>

                      {/* Cancel button if strictly upcoming */}
                      {!b.status.startsWith('Cancelada') && !isPassed && (
                        <button
                          onClick={() => handleOpenCancel(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Modal (Realizada con notas / No presentado) */}
      {quickActionModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuickActionModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                {quickActionModal.type === 'complete' ? (
                  <>
                    Validar clase como completada
                  </>
                ) : (
                  <>
                    Marcar alumno no presentado
                  </>
                )}
              </h3>
              <button
                onClick={() => setQuickActionModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 animate-fadeIn">
              <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <p className="font-bold text-slate-800">
                  {quickActionModal.booking.student_name}
                </p>
                <p className="text-slate-600">
                  {formatDisplayDate(quickActionModal.booking.date)} • {quickActionModal.booking.start_time} - {quickActionModal.booking.end_time} ({quickActionModal.booking.duration_minutes} min)
                </p>
                <p className="text-slate-500">
                  Profesor: {quickActionModal.booking.teacher_name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {quickActionModal.type === 'complete'
                    ? 'Notas u observaciones de la práctica (opcional)'
                    : 'Motivo de la ausencia'}
                </label>
                <textarea
                  rows={3}
                  value={quickActionModal.notes}
                  onChange={e => setQuickActionModal({ ...quickActionModal, notes: e.target.value })}
                  placeholder={
                    quickActionModal.type === 'complete'
                      ? 'Ej. Maniobras de estacionamiento realizadas correctamente. Buena progresión.'
                      : 'Ej. No acudió al punto de encuentro ni respondió a las llamadas.'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setQuickActionModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Volver
                </button>
                <button
                  disabled={quickActionLoading}
                  onClick={handleExecuteQuickAction}
                  className={`px-5 py-2.5 rounded-lg text-xs font-semibold text-white transition-colors ${quickActionModal.type === 'complete'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                >
                  {quickActionLoading
                    ? 'Guardando...'
                    : quickActionModal.type === 'complete'
                      ? 'Confirmar como completada'
                      : 'Confirmar ausencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {selectedBooking && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBooking(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Modificar estado de reserva</h3>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 animate-fadeIn">
              <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <span className="text-xs block">Alumno / Clase</span>
                <p className="text-xs font-semibold">
                  {selectedBooking.student_name}  /  {formatDisplayDate(selectedBooking.date)} ({selectedBooking.start_time})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nuevo Estado
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="Pendiente de revisión">Pendiente de revisión</option>
                  <option value="Completada">Completada</option>
                  <option value="No presentado">No presentado</option>
                  <option value="Cancelada por administrador">Cancelada por administrador</option>
                  <option value="Cancelada por alumno">Cancelada por alumno</option>
                  {!isBookingPassed(selectedBooking) && (
                    <option value="Reservada">Reservada</option>
                  )}
                </select>
                {isBookingPassed(selectedBooking) && newStatus === 'Reservada' && (
                  <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded-xl border border-amber-200">
                    Al ser una clase ya finalizada, no puede restablecerse como &ldquo;Reservada&rdquo;.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas adicionales
                </label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={e => setStatusNotes(e.target.value)}
                  placeholder="Ej. Alumno avisó por teléfono..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  disabled={statusLoading}
                  onClick={handleUpdateStatus}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
                >
                  {statusLoading ? 'Guardando...' : 'Guardar estado'}
                </button>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* Cancel Booking Confirmation Modal */}
      {cancellingBooking && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseCancel();
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Cancelar reserva de clase</span>
              </h3>
              <button onClick={handleCloseCancel} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <p>
                  <strong>Alumno:</strong> {cancellingBooking.student_name}
                  {cancellingBooking.student_email && ` (${cancellingBooking.student_email})`}
                </p>
                <p>
                  <strong>Profesor asignado:</strong> {cancellingBooking.teacher_name}
                </p>
                <p>
                  <strong>Fecha y horario:</strong> {formatDisplayDate(cancellingBooking.date)} •{' '}
                  {cancellingBooking.start_time} - {cancellingBooking.end_time} ({cancellingBooking.duration_minutes} min)
                </p>
                <p>
                  <strong>Estado actual:</strong> {cancellingBooking.status}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de la cancelación (visible en el registro e historial). Se notificará al alumno.
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Indica el motivo de la cancelación..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <p className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  Liberación del tramo de horario
                </p>
                <p className="leading-relaxed text-amber-800">
                  La reserva pasará a estado <strong>&ldquo;Cancelada por administrador&rdquo;</strong> y el hueco de clase quedará libre de nuevo para que pueda ser reservado por otro alumno.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseCancel}
                  disabled={cancelLoading}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300  transition-colors"
                >
                  {cancelLoading ? 'Cancelando reserva...' : 'Confirmar cancelación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

