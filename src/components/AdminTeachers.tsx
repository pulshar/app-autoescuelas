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

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm('¿Deseas dar de baja o eliminar a este profesor? Si tiene clases históricas, quedará desactivado.')) return;
    try {
      const res = await api.deleteTeacher(id);
      setFeedback({ type: 'success', message: res.message });
      fetchTeachers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al eliminar el profesor.' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestión de Profesores</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administra los instructores de la autoescuela, datos de contacto y estado de actividad.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Nuevo Profesor
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

      {/* Teachers Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Cargando profesores...
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No hay profesores dados de alta</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Crea tu primer profesor para comenzar a asignar agendas y turnos de conducción.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Añadir Profesor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teachers.map(t => (
            <div
              key={t.id}
              className={`bg-white rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between ${
                t.is_active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {t.photo_url ? (
                      <img
                        src={t.photo_url}
                        alt={t.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base">
                        {t.name[0]}
                        {t.last_name[0]}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">
                        {t.name} {t.last_name}
                      </h4>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mt-1 ${
                          t.is_active
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
                    className={`p-2 rounded-xl border transition-colors ${
                      t.is_active
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
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeacher(t.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
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
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {editingTeacher ? 'Editar Profesor' : 'Añadir Nuevo Profesor'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Juan"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL Fotografía</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Especialidad</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Especialista en maniobras, circuito cerrado..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 shadow-xs"
                >
                  {saving ? 'Guardando...' : 'Guardar Profesor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
