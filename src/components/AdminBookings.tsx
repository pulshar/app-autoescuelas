import { useState, useEffect } from 'react';

import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { Booking, Teacher } from '../types.ts';
import { useToast } from '../context/ToastContext.tsx';

import {
  Calendar,
  Clock,
  User as UserIcon,
  Search,
  CalendarPlus,
  Ban,
  Phone,
  Mail,
  X,
  Check,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

import { Button } from './common/Button.tsx';
import { StatusBadge } from './common/StatusBadge.tsx';

interface AdminBookingsProps {
  onOpenManualModal: () => void;
  refreshTrigger?: number;
}

export default function AdminBookings({
  onOpenManualModal,
  refreshTrigger,
}: AdminBookingsProps) {
  const [activeTab, setActiveTab] = useState<
    'pending_review' | 'upcoming' | 'history'
  >('upcoming');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const { toast } = useToast();

  // Quick Action Modal
  const [quickActionModal, setQuickActionModal] = useState<{
    booking: Booking;
    type: 'complete' | 'noshow';
    notes: string;
  } | null>(null);

  const [quickActionLoading, setQuickActionLoading] = useState(false);

  // Cancellation modal
  const [cancellingBooking, setCancellingBooking] =
    useState<Booking | null>(null);

  const [cancelReason, setCancelReason] = useState(
    'Cancelada directamente por el administrador'
  );

  const [cancelLoading, setCancelLoading] = useState(false);

  // Bulk selection for pending review
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  const [bulkConfirmModal, setBulkConfirmModal] = useState<{
    ids: string[];
    notes: string;
  } | null>(null);

  const [bulkLoading, setBulkLoading] = useState(false);

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
      toast('Error al cargar las reservas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    if (refreshTrigger && refreshTrigger > 0) {
      setActiveTab('upcoming');
      toast('Reserva registrada correctamente.', 'success');
    }
  }, [refreshTrigger]);

  // Escape para cerrar modales
  useEffect(() => {
    if (
      !cancellingBooking &&
      !quickActionModal &&
      !bulkConfirmModal
    ) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCancellingBooking(null);
        setQuickActionModal(null);
        setBulkConfirmModal(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    cancellingBooking,
    quickActionModal,
    bulkConfirmModal,
  ]);

  /*
   * ============================================================
   * FECHAS Y CLASIFICACIÓN
   * ============================================================
   */

  const now = new Date();

  const todayStr = now.toISOString().split('T')[0];

  const currentTime = `${String(now.getHours()).padStart(
    2,
    '0'
  )}:${String(now.getMinutes()).padStart(2, '0')}`;

  const isBookingPassed = (b: Booking) => {
    if (b.date < todayStr) {
      return true;
    }

    if (
      b.date === todayStr &&
      b.end_time <= currentTime
    ) {
      return true;
    }

    return false;
  };

  /*
   * Una clase está pendiente de revisión cuando:
   *
   * 1. Ya tiene explícitamente "Pendiente de revisión"
   * 2. O sigue como "Reservada" pero ya ha terminado
   *
   * Las Reservada que ya terminaron aparecen aquí para poder
   * validarlas manualmente.
   */
  const isPendingReviewBooking = (b: Booking) => {
    return (
      b.status === 'Pendiente de revisión' ||
      (b.status === 'Reservada' && isBookingPassed(b))
    );
  };

  /*
   * Próximas clases:
   *
   * Solo Reservada + todavía no ha terminado.
   *
   * En este estado la única acción permitida es CANCELAR.
   */
  const isUpcoming = (b: Booking) => {
    if (b.status !== 'Reservada') {
      return false;
    }

    return !isBookingPassed(b);
  };

  /*
   * 1. Clases pendientes de revisión
   */
  const pendingReviewBookings = bookings
    .filter(isPendingReviewBooking)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.start_time.localeCompare(a.start_time)
    );

  /*
   * 2. Próximas clases
   */
  const upcomingBookings = bookings
    .filter(isUpcoming)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.start_time.localeCompare(b.start_time)
    );

  /*
   * 3. Histórico
   *
   * Todo lo que no sea:
   * - Próxima clase
   * - Pendiente de revisión
   *
   * queda aquí.
   *
   * Estas reservas son SOLO LECTURA.
   */
  const historyBookings = bookings
    .filter(
      b =>
        !isPendingReviewBooking(b) &&
        !isUpcoming(b)
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.start_time.localeCompare(a.start_time)
    );

  /*
   * ============================================================
   * FILTROS
   * ============================================================
   */

  const applyFilters = (list: Booking[]) => {
    return list.filter(b => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();

        const match =
          b.student_name?.toLowerCase().includes(q) ||
          b.student_email?.toLowerCase().includes(q) ||
          b.teacher_name?.toLowerCase().includes(q) ||
          b.date.includes(q) ||
          formatDisplayDate(b.date)
            .toLowerCase()
            .includes(q);

        if (!match) {
          return false;
        }
      }

      if (
        filterTeacher &&
        b.teacher_id !== filterTeacher
      ) {
        return false;
      }

      if (
        filterStatus &&
        b.status !== filterStatus
      ) {
        return false;
      }

      if (
        filterDate &&
        b.date !== filterDate
      ) {
        return false;
      }

      return true;
    });
  };

  const filteredPending = applyFilters(
    pendingReviewBookings
  );

  const filteredUpcoming = applyFilters(
    upcomingBookings
  );

  const filteredHistory = applyFilters(
    historyBookings
  );

  const hasActiveFilters = Boolean(
    searchQuery ||
    filterTeacher ||
    filterStatus ||
    filterDate
  );

  const pendingCount = hasActiveFilters
    ? filteredPending.length
    : pendingReviewBookings.length;

  const upcomingCount = hasActiveFilters
    ? filteredUpcoming.length
    : upcomingBookings.length;

  const historyCount = hasActiveFilters
    ? filteredHistory.length
    : historyBookings.length;

  const displayedBookings =
    activeTab === 'pending_review'
      ? filteredPending
      : activeTab === 'upcoming'
        ? filteredUpcoming
        : filteredHistory;

  /*
   * ============================================================
   * SELECCIÓN MÚLTIPLE
   * ============================================================
   *
   * IMPORTANTE:
   * Solo se pueden seleccionar reservas con estado exacto
   * "Pendiente de revisión".
   *
   * Las "Reservada" que ya han pasado pueden validarse
   * individualmente, pero no forman parte de la selección masiva.
   */

  const selectablePendingBookings =
    activeTab === 'pending_review'
      ? displayedBookings.filter(
        b => b.status === 'Pendiente de revisión'
      )
      : [];

  const selectablePendingIds =
    selectablePendingBookings.map(b => b.id);

  /*
   * Revalidamos siempre contra el estado actual de bookings.
   */
  const validSelectedPendingIds =
    selectedPendingIds.filter(id =>
      bookings.some(
        b =>
          b.id === id &&
          b.status === 'Pendiente de revisión'
      )
    );

  const allVisibleSelected =
    selectablePendingIds.length > 0 &&
    selectablePendingIds.every(id =>
      validSelectedPendingIds.includes(id)
    );

  /*
   * ============================================================
   * CAMBIO DE PESTAÑA
   * ============================================================
   */

  const handleTabChange = (
    tab: 'pending_review' | 'upcoming' | 'history'
  ) => {
    setActiveTab(tab);

    setFilterStatus('');
    setSelectedPendingIds([]);
    setBulkConfirmModal(null);
  };

  /*
   * ============================================================
   * SELECCIÓN INDIVIDUAL
   * ============================================================
   */

  const toggleSelectBooking = (id: string) => {
    const booking = bookings.find(b => b.id === id);

    if (
      !booking ||
      booking.status !== 'Pendiente de revisión'
    ) {
      return;
    }

    setSelectedPendingIds(prev =>
      prev.includes(id)
        ? prev.filter(existingId => existingId !== id)
        : [...prev, id]
    );
  };

  /*
   * ============================================================
   * SELECCIONAR TODAS
   * ============================================================
   */

  const toggleSelectAllVisible = () => {
    if (selectablePendingIds.length === 0) {
      return;
    }

    if (allVisibleSelected) {
      setSelectedPendingIds(prev =>
        prev.filter(
          id => !selectablePendingIds.includes(id)
        )
      );
    } else {
      setSelectedPendingIds(prev => {
        const next = new Set(prev);

        selectablePendingIds.forEach(id => {
          next.add(id);
        });

        return Array.from(next);
      });
    }
  };

  /*
   * ============================================================
   * ACCIÓN MASIVA
   * ============================================================
   */

  const handleOpenBulkComplete = () => {
    const validIds = selectedPendingIds.filter(id =>
      bookings.some(
        b =>
          b.id === id &&
          b.status === 'Pendiente de revisión'
      )
    );

    if (validIds.length === 0) {
      toast(
        'No hay clases pendientes válidas para marcar como realizadas.',
        'error'
      );
      return;
    }

    setBulkConfirmModal({
      ids: validIds,
      notes: '',
    });
  };

  const handleExecuteBulkComplete = async () => {
    if (!bulkConfirmModal) {
      return;
    }

    /*
     * Volvemos a validar justo antes de guardar.
     */
    const validBulkIds = bulkConfirmModal.ids.filter(id =>
      bookings.some(
        b =>
          b.id === id &&
          b.status === 'Pendiente de revisión'
      )
    );

    if (validBulkIds.length === 0) {
      setBulkConfirmModal(null);
      setSelectedPendingIds([]);

      toast(
        'Las clases seleccionadas ya no están pendientes de revisión.',
        'error'
      );

      return;
    }

    setBulkLoading(true);

    try {
      const res = await api.bulkUpdateBookingStatus(
        validBulkIds,
        'Completada',
        bulkConfirmModal.notes.trim() || undefined
      );

      toast(
        res.message ||
        `${validBulkIds.length} clase${validBulkIds.length === 1 ? '' : 's'
        } marcada${validBulkIds.length === 1 ? '' : 's'
        } como realizada${validBulkIds.length === 1 ? '' : 's'
        }.`,
        'success'
      );

      setSelectedPendingIds(prev =>
        prev.filter(id => !validBulkIds.includes(id))
      );

      setBulkConfirmModal(null);

      await fetchBookings();
    } catch (err: any) {
      toast(
        err.message ||
        'Error al actualizar las clases seleccionadas.',
        'error'
      );
    } finally {
      setBulkLoading(false);
    }
  };

  /*
   * ============================================================
   * ACCIONES INDIVIDUALES DE PENDIENTE DE REVISIÓN
   * ============================================================
   */

  const handleExecuteQuickAction = async () => {
    if (!quickActionModal) {
      return;
    }

    /*
     * Revalidamos que la reserva siga pudiendo modificarse.
     */
    const currentBooking = bookings.find(
      b => b.id === quickActionModal.booking.id
    );

    if (
      !currentBooking ||
      !isPendingReviewBooking(currentBooking)
    ) {
      setQuickActionModal(null);

      toast(
        'Esta clase ya no está pendiente de revisión.',
        'error'
      );

      return;
    }

    setQuickActionLoading(true);

    const { booking, type, notes } = quickActionModal;

    const targetStatus =
      type === 'complete'
        ? 'Completada'
        : 'No presentado';

    const finalNotes = notes.trim()
      ? notes.trim()
      : type === 'complete'
        ? booking.notes
          ? booking.notes
          : 'Clase realizada y validada por el administrador'
        : booking.notes
          ? `${booking.notes} - No se presentó`
          : 'El alumno no se presentó a la clase';

    try {
      await api.updateBookingStatus(
        booking.id,
        targetStatus,
        finalNotes
      );

      toast(
        type === 'complete'
          ? `Clase de ${booking.student_name} validada como completada.`
          : `Clase de ${booking.student_name} registrada como No presentado.`,
        'success'
      );

      setQuickActionModal(null);

      await fetchBookings();
    } catch (err: any) {
      toast(
        err.message || 'Error al actualizar el estado.',
        'error'
      );
    } finally {
      setQuickActionLoading(false);
    }
  };

  /*
   * ============================================================
   * CANCELACIÓN
   * ============================================================
   *
   * La cancelación solo se puede abrir para una clase próxima.
   */

  const handleOpenCancel = (b: Booking) => {
    if (!isUpcoming(b)) {
      return;
    }

    setCancellingBooking(b);

    setCancelReason(
      'Cancelada directamente por el administrador'
    );
  };

  const handleCloseCancel = () => {
    setCancellingBooking(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) {
      return;
    }

    /*
     * Protección adicional antes de enviar.
     */
    const currentBooking = bookings.find(
      b => b.id === cancellingBooking.id
    );

    if (!currentBooking || !isUpcoming(currentBooking)) {
      toast(
        'Esta reserva ya no puede cancelarse porque ha dejado de ser una clase próxima.',
        'error'
      );

      handleCloseCancel();

      return;
    }

    setCancelLoading(true);

    try {
      const res = await api.cancelBooking(
        cancellingBooking.id,
        cancelReason.trim() ||
        'Cancelada directamente por el administrador'
      );

      toast(
        res.message || 'Reserva cancelada correctamente.',
        'success'
      );

      handleCloseCancel();

      await fetchBookings();
    } catch (err: any) {
      toast(
        err.message || 'Error al cancelar la reserva.',
        'error'
      );

      handleCloseCancel();
    } finally {
      setCancelLoading(false);
    }
  };

  /*
   * ============================================================
   * FILTROS
   * ============================================================
   */

  const clearFilters = () => {
    setFilterTeacher('');
    setFilterStatus('');
    setFilterDate('');
    setSearchQuery('');
  };

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Gestión de reservas
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administra reservas, valida clases finalizadas y
            cancela únicamente las clases próximas.
          </p>
        </div>

        <Button
          onClick={onOpenManualModal}
          leftIcon={<CalendarPlus className="w-4 h-4" />}
          className="shrink-0"
        >
          Nueva reserva
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />

            <input
              type="text"
              value={searchQuery}
              onChange={e =>
                setSearchQuery(e.target.value)
              }
              placeholder="Buscar alumno, email, profesor..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Teacher filter */}
          <div>
            <select
              value={filterTeacher}
              onChange={e =>
                setFilterTeacher(e.target.value)
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="">
                Todos los profesores
              </option>

              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date filter */}
          <div>
            <input
              type="date"
              value={filterDate}
              onChange={e =>
                setFilterDate(e.target.value)
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            />
          </div>
          {/* Status filter */}
          {activeTab === 'history' && (
            <div>
              <select
                value={filterStatus}
                onChange={e =>
                  setFilterStatus(e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
              >
                <option value="">
                  Todos los estados
                </option>

                <option value="Completada">
                  Completada
                </option>

                <option value="No presentado">
                  No presentado
                </option>

                <option value="Cancelada por alumno">
                  Cancelada por alumno
                </option>

                <option value="Cancelada por administrador">
                  Cancelada por administrador
                </option>

                <option value="Cancelada por bloqueo">
                  Cancelada por bloqueo
                </option>
              </select>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>
              Resultados filtrados: {displayedBookings.length}{' '}
              reservas
            </span>

            <button
              onClick={clearFilters}
              className="text-brand-600 hover:text-brand-800 font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Booking list */}
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 gap-4 sm:gap-6 overflow-x-auto hide-scrollbar">
          {/* Upcoming */}
          <button
            onClick={() =>
              handleTabChange('upcoming')
            }
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === 'upcoming'
              ? 'text-brand-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Próximas clases ({upcomingCount})

            {activeTab === 'upcoming' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
            )}
          </button>

          {/* History */}
          <button
            onClick={() =>
              handleTabChange('history')
            }
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === 'history'
              ? 'text-brand-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Histórico ({historyCount})

            {activeTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
            )}
          </button>

          {/* Pending Review */}
          <button
            onClick={() =>
              handleTabChange('pending_review')
            }
            className={`pb-3 text-sm font-bold transition-all relative flex items-center ${pendingCount > 0
              ? 'gap-1.5'
              : 'gap-0.5'
              } whitespace-nowrap ${activeTab === 'pending_review'
                ? 'text-brand-600'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <span className="flex items-center gap-1.5">
              Clases por revisar
            </span>

            <span
              className={
                pendingCount > 0
                  ? 'px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300'
                  : ''
              }
            >
              {pendingCount > 0
                ? pendingCount
                : `(${pendingCount})`}
            </span>

            {activeTab === 'pending_review' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Pending review alert */}
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
                  Confirma si fueron{' '}
                  <strong>completadas</strong> o si el alumno{' '}
                  <strong>no se presentó</strong>. Si no se revisa
                  en 72 horas, la clase pasará automáticamente a
                  Completada.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Booking table/cards */}
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

              {activeTab === 'pending_review' &&
                !hasActiveFilters && (
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Todas las clases pasadas han sido validadas
                    por el administrador o cerradas tras 72 horas.
                  </p>
                )}

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Bulk selection toolbar */}
              {activeTab === 'pending_review' &&
                selectablePendingBookings.length > 0 && (
                  <div className="grid px-4 sm:px-5 min-h-[65px] bg-slate-50 border-b border-slate-200 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={
                              toggleSelectAllVisible
                            }
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />

                          <span className="text-xs font-semibold text-slate-700">
                            Seleccionar todas
                          </span>
                        </label>

                        {validSelectedPendingIds.length >
                          0 && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[11px] font-semibold">
                              {validSelectedPendingIds.length}{' '}
                              seleccionadas
                            </span>
                          )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        {validSelectedPendingIds.length > 0 && (
                          <Button
                            size="sm"
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            type="button"
                            onClick={handleOpenBulkComplete}
                          >
                            Validar {validSelectedPendingIds.length} como completadas
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {displayedBookings.map(b => {
                const isPassed = isBookingPassed(b);

                const isPendingReview =
                  isPendingReviewBooking(b);

                const isUpcomingBooking =
                  isUpcoming(b);

                const isSelectable =
                  activeTab === 'pending_review' &&
                  b.status === 'Pendiente de revisión';

                const isSelected =
                  isSelectable &&
                  validSelectedPendingIds.includes(b.id);

                return (
                  <div
                    key={b.id}
                    className={`p-4 sm:p-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${isSelected
                      && 'bg-brand-50/80'
                      }`}
                  >
                    {/* Info block */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {isSelectable && (
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleSelectBooking(b.id)
                            }
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                            aria-label={`Seleccionar reserva de ${b.student_name}`}
                          />
                        </div>
                      )}

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-bold text-sm text-slate-900">
                            {b.student_name}
                          </span>

                          <StatusBadge status={b.status} />

                          <span className="text-[11px] text-slate-400">
                            ID: {b.id.slice(0, 8)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Calendar className="w-3.5 h-3.5 text-brand-600" />

                            {formatDisplayDate(b.date)}
                          </span>

                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-brand-600" />

                            {b.start_time} - {b.end_time}{' '}
                            ({b.duration_minutes} min)
                          </span>

                          <span className="flex items-center gap-1 text-slate-700">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />

                            Profesor: {b.teacher_name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                          {b.student_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />

                              {b.student_email}
                            </span>
                          )}

                          {b.student_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />

                              {b.student_phone}
                            </span>
                          )}

                          {b.notes && (
                            <span className="italic text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              "{b.notes}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      {/*
                       * PENDIENTE DE REVISIÓN
                       *
                       * Solo dos decisiones posibles:
                       * - Completada
                       * - No presentado
                       */}
                      {isPendingReview && (
                        <>
                          <button
                            onClick={() =>
                              setQuickActionModal({
                                booking: b,
                                type: 'noshow',
                                notes: b.notes || '',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                            title="Marcar falta de asistencia del alumno"
                          >

                            No presentado
                          </button>
                          <button
                            onClick={() =>
                              setQuickActionModal({
                                booking: b,
                                type: 'complete',
                                notes: b.notes || '',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="Confirmar que la clase se impartió con normalidad"
                          >

                            Completada
                          </button>
                        </>
                      )}

                      {/*
                       * PRÓXIMAS
                       *
                       * La única acción disponible es cancelar.
                       */}
                      {isUpcomingBooking && (
                        <button
                          onClick={() =>
                            handleOpenCancel(b)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />

                          Cancelar
                        </button>
                      )}

                      {/*
                       * HISTÓRICO
                       *
                       * No se muestra ningún botón.
                       *
                       * Una vez que una clase está:
                       * - Completada
                       * - No presentado
                       * - Cancelada
                       *
                       * queda cerrada y es solo lectura.
                       */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          BULK CONFIRMATION MODAL
          ====================================================== */}
      {bulkConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">

                Validar{' '}
                {bulkConfirmModal.ids.length}{' '}
                {bulkConfirmModal.ids.length === 1
                  ? 'clase'
                  : 'clases'}{' '}
                como completada
                {bulkConfirmModal.ids.length === 1
                  ? ''
                  : 's'}
              </h3>

              <button
                onClick={() =>
                  setBulkConfirmModal(null)
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 rounded-lg bg-brand-50/70 border border-brand-100 text-xs text-brand-950 space-y-2">
                <div className="space-y-2.5 max-h-40 overflow-y-auto">
                  {bulkConfirmModal.ids
                    .map(id =>
                      bookings.find(
                        b =>
                          b.id === id &&
                          b.status ===
                          'Pendiente de revisión'
                      )
                    )
                    .filter(
                      (b): b is Booking => Boolean(b)
                    )
                    .map(b => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-semibold text-slate-700 truncate">
                          {b.student_name}
                        </span>

                        <span className="text-slate-500 shrink-0">
                          {formatDisplayDate(b.date)} ·{' '}
                          {b.start_time}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota común (opcional)
                </label>

                <textarea
                  rows={3}
                  value={bulkConfirmModal.notes}
                  onChange={e =>
                    setBulkConfirmModal({
                      ...bulkConfirmModal,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Ej. Clases realizadas con normalidad."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="modal"
                  onClick={() =>
                    setBulkConfirmModal(null)
                  }
                  disabled={bulkLoading}
                >
                  Volver
                </Button>

                <Button
                  size="modal"
                  disabled={bulkLoading}
                  onClick={handleExecuteBulkComplete}
                >
                  {bulkLoading
                    ? 'Guardando...'
                    : 'Confirmar clases'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          QUICK ACTION MODAL
          ====================================================== */}
      {quickActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                {quickActionModal.type === 'complete'
                  ? 'Validar clase como completada'
                  : 'Marcar alumno no presentado'}
              </h3>

              <button
                onClick={() =>
                  setQuickActionModal(null)
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 animate-fadeIn">
              <div className="p-4 rounded-lg bg-brand-50/70 border border-brand-100 text-xs text-brand-950 space-y-1.5">
                <p className="font-bold text-slate-800">
                  {quickActionModal.booking.student_name}
                </p>

                <p className="text-slate-600">
                  {formatDisplayDate(
                    quickActionModal.booking.date
                  )}{' '}
                  • {quickActionModal.booking.start_time} -{' '}
                  {quickActionModal.booking.end_time} (
                  {quickActionModal.booking.duration_minutes}{' '}
                  min)
                </p>

                <p className="text-slate-500">
                  Profesor:{' '}
                  {quickActionModal.booking.teacher_name}
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
                  onChange={e =>
                    setQuickActionModal({
                      ...quickActionModal,
                      notes: e.target.value,
                    })
                  }
                  placeholder={
                    quickActionModal.type === 'complete'
                      ? 'Ej. Maniobras de estacionamiento realizadas correctamente. Buena progresión.'
                      : 'Ej. No acudió al punto de encuentro ni respondió a las llamadas.'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="modal"
                  onClick={() =>
                    setQuickActionModal(null)
                  }
                  disabled={quickActionLoading}
                >
                  Volver
                </Button>

                <Button
                  size="modal"
                  disabled={quickActionLoading}
                  onClick={handleExecuteQuickAction}
                >
                  {quickActionLoading
                    ? 'Guardando...'
                    : quickActionModal.type ===
                      'complete'
                      ? 'Confirmar como completada'
                      : 'Confirmar ausencia'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          CANCEL BOOKING CONFIRMATION MODAL
          ====================================================== */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Cancelar reserva de clase</span>
              </h3>

              <button
                onClick={handleCloseCancel}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-brand-50/70 border border-brand-100 text-xs text-brand-950 space-y-1.5">
                <p>
                  <strong>Alumno:</strong>{' '}
                  {cancellingBooking.student_name}

                  {cancellingBooking.student_email &&
                    ` (${cancellingBooking.student_email})`}
                </p>

                <p>
                  <strong>Profesor asignado:</strong>{' '}
                  {cancellingBooking.teacher_name}
                </p>

                <p>
                  <strong>Fecha y horario:</strong>{' '}
                  {formatDisplayDate(
                    cancellingBooking.date
                  )}{' '}
                  • {cancellingBooking.start_time} -{' '}
                  {cancellingBooking.end_time} (
                  {cancellingBooking.duration_minutes} min)
                </p>

                <p>
                  <strong>Estado actual:</strong>{' '}
                  {cancellingBooking.status}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de la cancelación (visible en el registro
                  e historial). Se notificará al alumno.
                </label>

                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={e =>
                    setCancelReason(e.target.value)
                  }
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
                  La reserva pasará a estado{' '}
                  <strong>
                    &ldquo;Cancelada por administrador&rdquo;
                  </strong>{' '}
                  y el hueco de clase quedará libre de nuevo
                  para que pueda ser reservado por otro alumno.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="modal"
                  onClick={handleCloseCancel}
                  disabled={cancelLoading}
                >
                  Volver
                </Button>

                <Button
                  size="modal"
                  variant="danger"
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                >
                  {cancelLoading
                    ? 'Cancelando reserva...'
                    : 'Confirmar cancelación'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}