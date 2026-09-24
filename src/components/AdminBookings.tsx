import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { Booking, Teacher, User } from '../types.ts';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  Ban,
  Phone,
  Mail,
  X,
  Edit2,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface AdminBookingsProps {
  onOpenManualModal: () => void;
}

export default function AdminBookings({ onOpenManualModal }: AdminBookingsProps) {
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

  // Cancellation modal
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelada directamente por el administrador');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const [bRes, tRes] = await Promise.all([
        api.getBookings({
          teacher_id: filterTeacher || undefined,
          status: filterStatus || undefined,
          date: filterDate || undefined,
        }),
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
  }, [filterTeacher, filterStatus, filterDate]);

  useEffect(() => {
    if (!selectedBooking && !cancellingBooking) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBooking(null);
        setCancellingBooking(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBooking, cancellingBooking]);

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

  const filteredBookings = bookings.filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.student_name?.toLowerCase().includes(q) ||
      b.student_email?.toLowerCase().includes(q) ||
      b.teacher_name?.toLowerCase().includes(q) ||
      b.date.includes(q) ||
      formatDisplayDate(b.date).includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Reservada':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Reservada</span>;
      case 'Confirmada':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmada</span>;
      case 'Completada':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Completada</span>;
      case 'Cancelada por alumno':
      case 'Cancelada por administrador':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">{status}</span>;
      case 'No presentado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">No presentado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestión de Reservas</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administra, confirma, modifica el estado o cancela reservas de clases prácticas.
          </p>
        </div>

        <button
          onClick={onOpenManualModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
        >
          <CalendarPlus className="w-4 h-4" /> Nueva Reserva Manual
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
              <option value="Reservada">Reservada</option>
              <option value="Confirmada">Confirmada</option>
              <option value="Completada">Completada</option>
              <option value="Cancelada por alumno">Cancelada por alumno</option>
              <option value="Cancelada por administrador">Cancelada por administrador</option>
              <option value="No presentado">No presentado</option>
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
            <span>Resultados filtrados: {filteredBookings.length} reservas</span>
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

      {/* Bookings Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
            Cargando reservas...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No se encontraron reservas con los criterios seleccionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredBookings.map(b => (
              <div
                key={b.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Info block */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-extrabold text-sm text-slate-900">
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

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => {
                      setSelectedBooking(b);
                      setNewStatus(b.status);
                      setStatusNotes(b.notes || '');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Estado
                  </button>

                  {!b.status.startsWith('Cancelada') && (
                    <button
                      onClick={() => handleOpenCancel(b)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  <option value="Reservada">Reservada</option>
                  <option value="Confirmada">Confirmada</option>
                  <option value="Completada">Completada</option>
                  <option value="Cancelada por administrador">Cancelada por administrador</option>
                  <option value="Cancelada por alumno">Cancelada por alumno</option>
                  <option value="No presentado">No presentado</option>
                </select>
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
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  disabled={statusLoading}
                  onClick={handleUpdateStatus}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
                >
                  {statusLoading ? 'Guardando...' : 'Guardar Estado'}
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
                  Motivo de la cancelación (visible en el registro e historial)
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
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 shadow-xs transition-colors"
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
