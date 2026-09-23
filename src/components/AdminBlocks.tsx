import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { ScheduleBlock, Teacher } from '../types.ts';
import {
  Ban,
  Calendar,
  Clock,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  User,
} from 'lucide-react';

interface AdminBlocksProps {
  initialOpenCreate?: boolean;
  onResetInitialOpenCreate?: () => void;
}

export default function AdminBlocks({ initialOpenCreate, onResetInitialOpenCreate }: AdminBlocksProps) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [teacherId, setTeacherId] = useState<string>(''); // '' = all
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [reason, setReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bRes, tRes] = await Promise.all([
        api.getBlocks(),
        api.getTeachers(),
      ]);
      setBlocks(bRes.blocks);
      setTeachers(tRes.teachers);
    } catch (err) {
      console.error('Error fetching blocks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialOpenCreate) {
      handleOpenCreate();
      onResetInitialOpenCreate?.();
    }
  }, [initialOpenCreate]);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const handleOpenCreate = () => {
    setTeacherId('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsFullDay(true);
    setStartTime('09:00');
    setEndTime('13:00');
    setReason('Día Festivo');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason) {
      setFeedback({ type: 'error', message: 'Fecha y motivo son obligatorios.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await api.createBlock({
        teacher_id: teacherId || null,
        date,
        is_full_day: isFullDay,
        start_time: isFullDay ? null : startTime,
        end_time: isFullDay ? null : endTime,
        reason: reason.trim(),
      });

      setFeedback({ type: 'success', message: 'Bloqueo registrado correctamente.' });
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar el bloqueo.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas desbloquear este horario?')) return;
    try {
      await api.deleteBlock(id);
      setFeedback({ type: 'success', message: 'Bloqueo eliminado.' });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al eliminar el bloqueo.' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Bloqueos y Excepciones</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gestiona días festivos, vacaciones, bajas médicas o exámenes prácticos donde no se impartirán clases.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Nuevo Bloqueo
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Blocks List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Cargando bloqueos...
        </div>
      ) : blocks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Ban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No hay bloqueos activos</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Puedes bloquear días festivos o franjas horarias específicas para evitar que los alumnos reserven en esos momentos.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Añadir Bloqueo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map(b => (
            <div
              key={b.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {b.is_full_day ? 'Día Completo' : `${b.start_time} - ${b.end_time}`}
                  </span>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-extrabold text-base text-slate-900 mt-2">{b.reason}</h4>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{formatDisplayDate(b.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Afecta a: {b.teacher_name}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                Ref: {b.id.slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Crear Bloqueo de Horario</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profesor afectado
                </label>
                <select
                  value={teacherId}
                  onChange={e => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  <option value="">Todos los profesores (Cierre global)</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="fullDay"
                    checked={isFullDay}
                    onChange={e => setIsFullDay(e.target.checked)}
                    className="rounded-md text-indigo-600"
                  />
                  <label htmlFor="fullDay" className="text-xs font-semibold text-slate-700">
                    Bloquear día completo
                  </label>
                </div>

                {!isFullDay && (
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Hora Inicio</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Hora Fin</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo del Bloqueo *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ej. Día Festivo Nacional, Exámenes DGT, Baja médica..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 shadow-xs"
                >
                  {saving ? 'Guardando...' : 'Crear Bloqueo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
