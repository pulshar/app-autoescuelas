import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatDisplayDate } from '../lib/dateUtils.ts';
import type { Schedule, Teacher, WeeklyHour } from '../types.ts';
import {
  Calendar,
  Clock,
  PlusCircle,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Power,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' },
  { id: 7, name: 'Domingo' },
];

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form
  const [teacherId, setTeacherId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [timezone, setTimezone] = useState('Europe/Madrid');

  // Weekly intervals in form: Array of { day_of_week: number, start_time: string, end_time: string }
  const [weeklyHours, setWeeklyHours] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sRes, tRes] = await Promise.all([
        api.getSchedules(),
        api.getTeachers(),
      ]);
      setSchedules(sRes.schedules);
      setTeachers(tRes.teachers);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    setEditingSchedule(null);
    setTeacherId(teachers[0]?.id || '');
    setName('Horario General');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsIndefinite(true);
    setIsActive(true);
    setTimezone('Europe/Madrid');

    // Default Monday to Friday 09:00-13:00 and 16:00-20:00
    const defaultHours: any[] = [];
    for (let day = 1; day <= 5; day++) {
      defaultHours.push({ day_of_week: day, start_time: '09:00', end_time: '13:00' });
      defaultHours.push({ day_of_week: day, start_time: '16:00', end_time: '20:00' });
    }
    setWeeklyHours(defaultHours);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Schedule) => {
    setEditingSchedule(s);
    setTeacherId(s.teacher_id);
    setName(s.name);
    setStartDate(s.start_date);
    setEndDate(s.end_date || '');
    setIsIndefinite(!s.end_date);
    setIsActive(s.is_active);
    setTimezone(s.timezone || 'Europe/Madrid');
    setWeeklyHours(
      s.weekly_hours?.map(wh => ({
        day_of_week: wh.day_of_week,
        start_time: wh.start_time,
        end_time: wh.end_time,
      })) || []
    );
    setModalOpen(true);
  };

  const handleAddInterval = (dayOfWeek: number) => {
    setWeeklyHours(prev => [
      ...prev,
      { day_of_week: dayOfWeek, start_time: '10:00', end_time: '14:00' },
    ]);
  };

  const handleRemoveInterval = (index: number) => {
    setWeeklyHours(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateInterval = (index: number, field: 'start_time' | 'end_time', value: string) => {
    setWeeklyHours(prev =>
      prev.map((wh, i) => (i === index ? { ...wh, [field]: value } : wh))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !name || !startDate) {
      setFeedback({ type: 'error', message: 'Profesor, nombre y fecha de inicio son requeridos.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        teacher_id: teacherId,
        name: name.trim(),
        start_date: startDate,
        end_date: isIndefinite ? null : endDate || null,
        is_active: isActive,
        timezone,
        weekly_hours: weeklyHours,
      };

      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, payload);
        setFeedback({ type: 'success', message: 'Agenda actualizada correctamente.' });
      } else {
        await api.createSchedule(payload);
        setFeedback({ type: 'success', message: 'Nueva agenda creada con éxito.' });
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar la agenda.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta agenda?')) return;
    try {
      await api.deleteSchedule(id);
      setFeedback({ type: 'success', message: 'Agenda eliminada.' });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al eliminar agenda.' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Agendas de Profesores</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configura los intervalos semanales de disponibilidad (turnos de mañana y tarde).
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Crear Nueva Agenda
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

      {/* Schedules List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Cargando agendas...
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No hay agendas configuradas</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Configura las jornadas semanales para tus profesores para que los alumnos puedan reservar turnos.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Crear Agenda
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">{s.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.is_active ? 'Activa' : 'Pausada'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Profesor: <strong className="text-slate-800">{s.teacher_name}</strong> • Vigencia:{' '}
                    {formatDisplayDate(s.start_date)}{' '}
                    {s.end_date ? `hasta ${formatDisplayDate(s.end_date)}` : '(Indefinida)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(s.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </div>

              {/* Weekly intervals overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-4">
                {DAYS_OF_WEEK.map(day => {
                  const intervals = s.weekly_hours?.filter(wh => wh.day_of_week === day.id) || [];
                  const isConfigured = intervals.length > 0;

                  return (
                    <div
                      key={day.id}
                      className={`p-2.5 rounded-2xl border text-center ${
                        isConfigured
                          ? 'bg-indigo-50/40 border-indigo-200'
                          : 'bg-slate-50/50 border-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1 text-slate-800">
                        {day.name.slice(0, 3)}
                      </span>
                      {isConfigured ? (
                        <div className="space-y-1">
                          {intervals.map((inv, idx) => (
                            <span
                              key={idx}
                              className="inline-block text-[10px] font-bold bg-white text-indigo-700 px-1.5 py-0.5 rounded-md border border-indigo-100 shadow-2xs"
                            >
                              {inv.start_time}-{inv.end_time}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Libre</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Edit / Create Modal */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {editingSchedule ? 'Editar Agenda' : 'Crear Nueva Agenda'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Profesor</label>
                  <select
                    value={teacherId}
                    onChange={e => setTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Agenda</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Jornada Estándar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Fecha de Fin</label>
                    <label className="text-[11px] text-indigo-600 flex items-center gap-1 font-semibold">
                      <input
                        type="checkbox"
                        checked={isIndefinite}
                        onChange={e => setIsIndefinite(e.target.checked)}
                        className="rounded-sm"
                      />
                      Indefinida
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={isIndefinite}
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs disabled:bg-slate-100 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Weekly intervals editor */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-900 mb-2">
                  Franjas Horarias Semanales (Lunes a Domingo):
                </label>

                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 max-h-60 overflow-y-auto">
                  {DAYS_OF_WEEK.map(day => {
                    const intervalsForDay = weeklyHours
                      .map((wh, originalIndex) => ({ ...wh, originalIndex }))
                      .filter(wh => wh.day_of_week === day.id);

                    return (
                      <div
                        key={day.id}
                        className="p-2.5 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="w-24">
                          <span className="font-bold text-xs text-slate-800">{day.name}</span>
                        </div>

                        {/* Interval chips */}
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          {intervalsForDay.length === 0 ? (
                            <span className="text-[11px] text-slate-400 italic">Día no laborable</span>
                          ) : (
                            intervalsForDay.map(inv => (
                              <div
                                key={inv.originalIndex}
                                className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs"
                              >
                                <input
                                  type="time"
                                  value={inv.start_time}
                                  onChange={e =>
                                    handleUpdateInterval(inv.originalIndex, 'start_time', e.target.value)
                                  }
                                  className="px-1 py-0.5 bg-white border border-slate-300 rounded-md text-[11px]"
                                />
                                <span>-</span>
                                <input
                                  type="time"
                                  value={inv.end_time}
                                  onChange={e =>
                                    handleUpdateInterval(inv.originalIndex, 'end_time', e.target.value)
                                  }
                                  className="px-1 py-0.5 bg-white border border-slate-300 rounded-md text-[11px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInterval(inv.originalIndex)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddInterval(day.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold shrink-0 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Turno
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="scheduleActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="scheduleActive" className="text-xs font-semibold text-slate-700">
                  Agenda activa para la generación de slots
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
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
                  {saving ? 'Guardando...' : 'Guardar Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
