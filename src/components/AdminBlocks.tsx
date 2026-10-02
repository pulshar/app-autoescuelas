import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { ScheduleBlock, Teacher } from '../types.ts';
import {
  Ban,
  Calendar,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Mail,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './common/Button.tsx';

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

  // Notification & Conflict States
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [notifyTeachers, setNotifyTeachers] = useState(true);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete modal state
  const [deletingBlock, setDeletingBlock] = useState<ScheduleBlock | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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
    if (!modalOpen && !deletingBlock) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setDeletingBlock(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, deletingBlock]);


  // Check conflicts live when parameters change
  useEffect(() => {
    if (!modalOpen || !date) {
      setConflicts([]);
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        setCheckingConflicts(true);
        const res = await api.checkBlockConflicts({
          date,
          teacher_id: teacherId || null,
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
        });
        if (isCurrent) {
          setConflicts(res.conflicts || []);
        }
      } catch (err) {
        console.error('Error checking block conflicts:', err);
      } finally {
        if (isCurrent) {
          setCheckingConflicts(false);
        }
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [modalOpen, date, teacherId, isFullDay, startTime, endTime]);


  const handleOpenCreate = () => {
    setTeacherId('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsFullDay(true);
    setStartTime('09:00');
    setEndTime('13:00');
    setReason('Día Festivo');
    setNotifyStudents(true);
    setNotifyTeachers(true);
    setConflicts([]);
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
      const res = await api.createBlock({
        teacher_id: teacherId || null,
        date,
        is_full_day: isFullDay,
        start_time: isFullDay ? null : startTime,
        end_time: isFullDay ? null : endTime,
        reason: reason.trim(),
        notifyStudents,
        notifyTeachers,
      });

      setFeedback({ type: 'success', message: res.message || 'Bloqueo registrado correctamente.' });
      setTimeout(() => setFeedback(null), 7000);
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar el bloqueo.' });
      setTimeout(() => setFeedback(null), 6000);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (b: ScheduleBlock) => {
    setDeletingBlock(b);
  };

  const handleCloseDelete = () => {
    setDeletingBlock(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBlock) return;
    try {
      setDeleteSubmitting(true);
      await api.deleteBlock(deletingBlock.id);
      setFeedback({ type: 'success', message: 'Bloqueo eliminado correctamente.' });
      setTimeout(() => setFeedback(null), 5000);
      handleCloseDelete();
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al eliminar el bloqueo.' });
      setTimeout(() => setFeedback(null), 6000);
      handleCloseDelete();
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Bloqueos y excepciones</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gestiona días festivos, vacaciones, bajas médicas o exámenes prácticos donde no se impartirán clases.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          leftIcon={<PlusCircle className="w-4 h-4" />}
          className="shrink-0"
        >
          Nuevo bloqueo
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs sm:text-sm flex items-center justify-between gap-2 transition-all ${feedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Blocks List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Cargando bloqueos...
        </div>
      ) : blocks.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Ban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No hay bloqueos activos</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Puedes bloquear días festivos o franjas horarias específicas para evitar que los alumnos reserven en esos momentos.
          </p>
          <Button
            onClick={handleOpenCreate}
            size="modal"
            className="shrink-0 mt-4"
          >
            Añadir bloqueo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map(b => (
            <div
              key={b.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {b.is_full_day ? 'Día Completo' : `${b.start_time} - ${b.end_time}`}
                  </span>
                  <button
                    onClick={() => handleOpenDelete(b)}
                    title="Desbloquear / Eliminar bloqueo"
                    className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-bold text-base text-slate-900 mt-2">{b.reason}</h4>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-brand-600" />
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
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Crear bloqueo de horario</h3>
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="checkbox"
                    id="fullDay"
                    checked={isFullDay}
                    onChange={e => setIsFullDay(e.target.checked)}
                    className="rounded-md text-brand-600"
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              {/* Conflict warning if existing bookings coincide */}
              {conflicts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 mt-6 border border-amber-200 text-xs text-amber-950 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Se cancelarán {conflicts.length} clase(s) en conflicto:</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] pr-1">
                    {conflicts.map(c => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between bg-white/80 p-2 rounded-xl border border-amber-200/60 text-slate-800"
                      >
                        <span className="truncate mr-2">
                          <strong>{c.student_name}</strong> • Prof. {c.teacher_name}
                        </span>
                        <span className="font-mono text-slate-800 font-semibold shrink-0">
                          {c.start_time} - {c.end_time}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Estas reservas pasarán automáticamente a estado <strong>Cancelada por bloqueo</strong>.
                  </p>
                </div>
              )}

              {/* Notification Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {/* Conflict warning if existing bookings coincide */}
                {conflicts.length > 0 && (
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifyStudents}
                      onChange={e => setNotifyStudents(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 w-4 h-4"
                    />
                    <span className="text-xs text-slate-700 leading-tight">
                      <strong className="text-slate-900 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 inline" />
                        Notificar por email a los alumnos afectados
                      </strong>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Recibirán un aviso informándoles del motivo ({reason || 'bloqueo'}) e invitándoles a reprogramar.
                      </span>
                    </span>
                  </label>
                )}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyTeachers}
                    onChange={e => setNotifyTeachers(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 w-4 h-4"
                  />
                  <span className="text-xs text-slate-700 leading-tight">
                    <strong className="text-slate-900 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 inline" />
                      Avisar por email al profesorado afectado
                    </strong>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Se enviará un correo informando del bloqueo en su cuadrante y el desglose de clases canceladas si aplica.
                    </span>
                  </span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="modal"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="modal"
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Crear bloqueo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Desbloquear Confirmation Modal */}
      {deletingBlock && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Desbloquear horario y eliminar bloqueo</span>
              </h3>
              <button onClick={handleCloseDelete} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-brand-50/70 border border-brand-100 text-xs text-brand-950 space-y-1.5">
                <p>
                  <strong>Motivo:</strong> {deletingBlock.reason}
                </p>
                <p>
                  <strong>Fecha:</strong> {formatDisplayDate(deletingBlock.date)}
                </p>
                <p>
                  <strong>Tramo horario:</strong>{' '}
                  {deletingBlock.is_full_day
                    ? 'Día completo'
                    : `${deletingBlock.start_time} - ${deletingBlock.end_time}`}
                </p>
                <p>
                  <strong>Profesor afectado:</strong>{' '}
                  {deletingBlock.teacher_name || 'Todos los profesores (Cierre global)'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <p className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  Efecto de la reactivación del horario
                </p>
                <p className="leading-relaxed text-amber-800">
                  Al eliminar este bloqueo, el tramo horario volverá a quedar habilitado para que los alumnos puedan reservar clases según las agendas semanales activas.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="modal"
                  onClick={handleCloseDelete}
                  disabled={deleteSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  size="modal"
                  variant="danger"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                >
                  {deleteSubmitting ? 'Desbloqueando...' : 'Desbloquear horario'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
