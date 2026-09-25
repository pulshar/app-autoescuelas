import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import type { Teacher } from '../types.ts';
import {
  User,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  X,
  Power,
  ShieldCheck,
} from 'lucide-react';

interface AdminTeachersProps {
  initialOpenCreate?: boolean;
  onResetInitialOpenCreate?: () => void;
}

export default function AdminTeachers({ initialOpenCreate, onResetInitialOpenCreate }: AdminTeachersProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Form
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete / Baja Modal state
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await api.getTeachers();
      setTeachers(res.teachers);
    } catch (err: any) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
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
    setEditingTeacher(null);
    setName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPhotoUrl('');
    setNotes('');
    setIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setLastName(t.last_name);
    setEmail(t.email || '');
    setPhone(t.phone || '');
    setPhotoUrl(t.photo_url || '');
    setNotes(t.notes || '');
    setIsActive(t.is_active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        name: name.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        is_active: isActive,
      };

      if (editingTeacher) {
        await api.updateTeacher(editingTeacher.id, payload);
        setFeedback({ type: 'success', message: 'Profesor actualizado correctamente.' });
      } else {
        await api.createTeacher(payload);
        setFeedback({ type: 'success', message: 'Nuevo profesor añadido con éxito.' });
      }

      setModalOpen(false);
      fetchTeachers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar el profesor.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: Teacher) => {
    try {
      await api.updateTeacher(t.id, { is_active: !t.is_active });
      fetchTeachers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al cambiar estado.' });
    }
  };

  const handleOpenDelete = (t: Teacher) => {
    setDeletingTeacher(t);
  };

  const handleCloseDelete = () => {
    setDeletingTeacher(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTeacher) return;
    try {
      setDeleteSubmitting(true);
      const res = await api.deleteTeacher(deletingTeacher.id);
      setFeedback({ type: 'success', message: res.message });
      setTimeout(() => setFeedback(null), 5000);
      handleCloseDelete();
      fetchTeachers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al eliminar el profesor.' });
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
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gestión de profesores</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administra los instructores de la autoescuela, datos de contacto y estado de actividad.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Nuevo profesor
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg text-xs sm:text-sm flex items-center gap-2 ${feedback.type === 'success'
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

      {/* Teachers Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Cargando profesores...
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No hay profesores dados de alta</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Crea tu primer profesor para comenzar a asignar agendas y turnos de conducción.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
          >
            Añadir Profesor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teachers.map(t => (
            <div
              key={t.id}
              className={`bg-white rounded-xl p-5 border shadow-xs transition-all flex flex-col justify-between ${t.is_active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 bg-slate-50/70 opacity-75'
                }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {t.photo_url ? (
                      <img
                        src={t.photo_url}
                        alt={t.name}
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base">
                        {t.name[0]}
                        {t.last_name[0]}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-base text-slate-900">
                        {t.name} {t.last_name}
                      </h4>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mt-1 ${t.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                          }`}
                      >
                        {t.is_active ? 'En activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleActive(t)}
                    title={t.is_active ? 'Desactivar profesor' : 'Activar profesor'}
                    className={`p-2 rounded-xl border transition-colors ${t.is_active
                      ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                      : 'text-slate-400 hover:bg-slate-200 border-slate-300'
                      }`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  {t.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.email}</span>
                    </div>
                  )}
                  {t.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.phone}</span>
                    </div>
                  )}
                  {t.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed">
                      {t.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">ID: {t.id}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-1.5 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenDelete(t)}
                    title="Eliminar o dar de baja profesor"
                    className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {editingTeacher ? 'Editar profesor' : 'Añadir nuevo profesor'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Juan"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Ej. García Moreno"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="profesor@autoescuela.es"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL Fotografía</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Especialidad</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Especialista en maniobras, circuito cerrado..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="teacherActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="teacherActive" className="text-xs font-semibold text-slate-700">
                  Profesor activo para reservas
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {saving ? 'Guardando...' : 'Guardar profesor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Baja Confirmation Modal */}
      {deletingTeacher && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseDelete();
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Eliminar o dar de baja profesor</span>
              </h3>
              <button onClick={handleCloseDelete} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <p>
                  <strong>Profesor:</strong> {deletingTeacher.name} {deletingTeacher.last_name || ''}
                </p>
                <p>
                  <strong>Email:</strong> {deletingTeacher.email}
                </p>
                {deletingTeacher.phone && (
                  <p>
                    <strong>Teléfono:</strong> {deletingTeacher.phone}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <p className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  Protección de registros y estadísticas
                </p>
                <p className="leading-relaxed text-amber-800">
                  Si este profesor tiene clases prácticas asignadas o registradas en el historial:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-amber-800">
                  <li>Se marcará automáticamente como <strong>Inactivo / Baja</strong>.</li>
                  <li>Se conservará íntegramente todo el historial de clases y partes de asistencia para las métricas de la autoescuela.</li>
                  <li>Si nunca ha tenido clases registradas, se eliminará permanentemente del sistema.</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseDelete}
                  disabled={deleteSubmitting}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300  transition-colors"
                >
                  {deleteSubmitting ? 'Procesando...' : 'Confirmar baja / eliminación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
