import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { Teacher, User, TimeSlot } from '../types.ts';
import {
  X,
  CalendarPlus,
  User as UserIcon,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ManualBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ManualBookingModal({ isOpen, onClose, onSuccess }: ManualBookingModalProps) {
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadData() {
      try {
        const [stdRes, tchRes] = await Promise.all([
          api.getStudents(),
          api.getTeachers(),
        ]);
        setStudents(stdRes.students);
        setTeachers(tchRes.teachers.filter(t => t.is_active));
        if (stdRes.students.length > 0) setSelectedStudentId(stdRes.students[0].id);
        if (tchRes.teachers.length > 0) setSelectedTeacherId(tchRes.teachers[0].id);
      } catch (err) {
        console.error('Error loading modal data:', err);
      }
    }
    loadData();
  }, [isOpen]);

  // Load slots whenever teacher or date changes
  useEffect(() => {
    if (!isOpen || !selectedDate || !selectedTeacherId) return;
    async function loadSlots() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const res = await api.getSlots(selectedDate, selectedTeacherId);
        setSlots(res.slots);
      } catch (err) {
        console.error('Error loading slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [isOpen, selectedDate, selectedTeacherId]);

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
    if (!selectedStudentId || !selectedTeacherId || !selectedDate || !selectedSlot) {
      setError('Por favor completa todos los campos y selecciona un horario.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.createBooking({
        student_id: selectedStudentId,
        teacher_id: selectedTeacherId,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        // notes: notes.trim() ? `[Reserva manual]: ${notes.trim()}` : '[Reserva manual administrativa]',
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar la reserva manual.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
    >
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col cursor-default">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Crear nueva reserva</h3>
              <p className="text-[11px] text-slate-500">Para reservas telefónicas o presenciales</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Student selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alumno destinatario
            </label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium bg-white"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>

          {/* Teacher selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Profesor</label>
            <select
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium bg-white"
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha {selectedDate && <span className="text-indigo-600 font-bold ml-1">({formatDisplayDate(selectedDate)})</span>}
            </label>
            <input
              type="date"
              required
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium bg-white"
            />
          </div>

          {/* Slots selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Horario disponible
            </label>
            {loadingSlots ? (
              <div className="py-6 text-center text-xs text-slate-400">Cargando turnos...</div>
            ) : slots.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                El profesor no tiene turnos configurados para esta fecha.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1">
                {slots.map((s, idx) => {
                  const isSelected = selectedSlot?.start_time === s.start_time;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!s.is_available}
                      onClick={() => setSelectedSlot(s)}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${!s.is_available
                        ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-800'
                        }`}
                    >
                      <span>{s.start_time} - {s.end_time}</span>
                      {!s.is_available && (
                        <span className="block text-[10px] text-rose-600 font-normal">
                          {s.reason_unavailable}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej. Solicitado por teléfono a las 10:00..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedSlot}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300  transition-colors"
            >
              {submitting ? 'Creando...' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
