import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import type { User } from '../types.ts';
import {
  Users,
  Search,
  Phone,
  Mail,
  CalendarPlus,
  UserPlus,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  ShieldCheck,
  Info,
  Edit2,
  Trash2,
} from 'lucide-react';

interface AdminStudentsProps {
  onSelectStudentForBooking: (studentId: string) => void;
}

interface StudentWithMetrics extends User {
  total_bookings?: number;
  completed_classes?: number;
  active_classes?: number;
}

export default function AdminStudents({ onSelectStudentForBooking }: AdminStudentsProps) {
  const [students, setStudents] = useState<StudentWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    student: StudentWithMetrics;
    initialPassword: string;
    emailResult?: any;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentWithMetrics | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete / Baja Modal State
  const [deletingStudent, setDeletingStudent] = useState<StudentWithMetrics | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Global Feedback Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Re-send welcome email state
  const [schoolName, setSchoolName] = useState<string>('AutoescuelaPro');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    return `Auto${randomDigits}!`;
  };

  const handleOpenModal = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword(generateRandomPassword());
    setShowPassword(false);
    setFormError(null);
    setSuccessData(null);
    setCopied(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSuccessData(null);
    setFormError(null);
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.getStudents();
      setStudents(res.students as StudentWithMetrics[]);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    api.getSettings().then(res => {
      if (res?.settings?.school_name) setSchoolName(res.settings.school_name);
    }).catch(() => { });
  }, []);

  // Creation Handler
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Por favor, indica el nombre y apellidos del alumno.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setFormError('Por favor, introduce un correo electrónico válido.');
      return;
    }

    if (!password.trim() || password.trim().length < 6) {
      setFormError('La contraseña inicial debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createStudent({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password: password.trim(),
      });

      setSuccessData({
        student: res.student as StudentWithMetrics,
        initialPassword: res.initialPassword,
        emailResult: res.emailResult,
      });

      await fetchStudents();
    } catch (err: any) {
      console.error('Error creating student:', err);
      setFormError(err.message || 'Error al dar de alta al alumno.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successData) return;
    const textToCopy = `Acceso ${schoolName}\nAlumno: ${successData.student.name}\nEmail: ${successData.student.email}\nContraseña inicial: ${successData.initialPassword}\n\n*Recuerda cambiar tu contraseña en "Mi perfil" tras acceder.`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Edit Handlers
  const handleOpenEdit = (student: StudentWithMetrics) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEmail(student.email);
    setEditPhone(student.phone || '');
    setEditPassword('');
    setEditShowPassword(false);
    setEditIsActive(student.is_active !== false);
    setEditError(null);
  };

  const handleCloseEdit = () => {
    setEditingStudent(null);
    setEditError(null);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError('El nombre y apellidos son obligatorios.');
      return;
    }

    if (!editEmail.trim() || !editEmail.includes('@')) {
      setEditError('Introduce un correo electrónico válido.');
      return;
    }

    if (editPassword && editPassword.trim().length < 6) {
      setEditError('La nueva contraseña debe tener al menos 6 caracteres (o dejarla vacía).');
      return;
    }

    try {
      setEditSubmitting(true);
      const res = await api.updateStudent(editingStudent.id, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim() || undefined,
        password: editPassword.trim() || undefined,
        is_active: editIsActive,
      });

      setFeedback({ type: 'success', message: res.message || 'Alumno actualizado correctamente.' });
      setTimeout(() => setFeedback(null), 5000);
      handleCloseEdit();
      await fetchStudents();
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar el alumno.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete / Baja Handlers
  const handleOpenDelete = (student: StudentWithMetrics) => {
    setDeletingStudent(student);
  };

  const handleCloseDelete = () => {
    setDeletingStudent(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    try {
      setDeleteSubmitting(true);
      const res = await api.deleteStudent(deletingStudent.id);
      setFeedback({ type: 'success', message: res.message });
      setTimeout(() => setFeedback(null), 6000);
      handleCloseDelete();
      await fetchStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al procesar la solicitud.' });
      setTimeout(() => setFeedback(null), 6000);
      handleCloseDelete();
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Re-send Welcome Email Handler
  const handleResendWelcome = async (student: StudentWithMetrics) => {
    try {
      setResendingId(student.id);
      const res = await api.resendWelcomeEmail(student.id);
      setFeedback({
        type: 'success',
        message: res.message || `Correo de acceso reenviado a ${student.email}`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al reenviar correo de acceso',
      });
      setTimeout(() => setFeedback(null), 6000);
    } finally {
      setResendingId(null);
    }
  };

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Creation Button */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Alumnos registrados</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {students.length} alumnos
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Directorio de alumnos con métricas de clases prácticas cursadas, altas, edición y gestión de accesos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* New Student Button */}
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm  transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Dar de alta alumno</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
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

      {/* Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
            Cargando directorio de alumnos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">No se encontraron alumnos registrados.</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Puedes dar de alta al primer alumno pulsando en el botón superior &ldquo;Dar de alta Alumno&rdquo;.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(s => {
              const isInactive = s.is_active === false;

              return (
                <div
                  key={s.id}
                  className={`p-4 sm:p-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${isInactive ? 'bg-slate-50/50 opacity-80' : 'hover:bg-slate-50/70'
                    }`}
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-base shrink-0 shadow-2xs ${isInactive
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-indigo-100 text-indigo-700'
                        }`}
                    >
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                          {s.name}
                        </h4>
                        {isInactive && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                            Baja / Inactivo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {s.email}
                        </span>
                        {s.phone && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {s.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metrics & Actions */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-5 pt-2 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div className="text-center min-w-[45px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Activas
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-indigo-700">
                          {s.active_classes || 0}
                        </span>
                      </div>

                      <div className="text-center min-w-[45px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Completadas
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-700">
                          {s.completed_classes || 0}
                        </span>
                      </div>

                      <div className="text-center min-w-[45px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {s.total_bookings || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {/* Resend email button */}
                      <button
                        onClick={() => handleResendWelcome(s)}
                        disabled={resendingId === s.id}
                        title="Reenviar correo de bienvenida con instrucciones de acceso"
                        className="inline-flex items-center gap-1.5 p-1.5 xl:px-3 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="hidden xl:inline">
                          {resendingId === s.id ? 'Enviando...' : 'Reenviar'}
                        </span>
                      </button>

                      {/* Book class button */}
                      <button
                        onClick={() => onSelectStudentForBooking(s.id)}
                        disabled={isInactive}
                        title={isInactive ? 'Alumno dado de baja' : 'Asignar clase práctica'}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${isInactive
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                          }`}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Asignar Clase</span>
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => handleOpenEdit(s)}
                        title="Editar alumno"
                        className="p-1.5 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete / Baja button */}
                      <button
                        onClick={() => handleOpenDelete(s)}
                        title={
                          (s.total_bookings || 0) > 0
                            ? 'Dar de baja al alumno (proteger histórico)'
                            : 'Eliminar alumno permanentemente'
                        }
                        className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE STUDENT MODAL */}
      {isModalOpen && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Añadir nuevo alumno</h3>
              <button onClick={() => handleCloseModal()} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {successData ? (
                /* Success View */
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>¡Alumno registrado con éxito en la plataforma!</span>
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Se ha enviado un correo de bienvenida a <strong>{successData.student.email}</strong> explicando cómo acceder con su contraseña inicial y cómo cambiarla en su sección <strong>&ldquo;Mi perfil&rdquo;</strong>.
                    </p>
                  </div>

                  {/* Summary of credentials */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Credenciales asignadas:
                      </span>
                      <button
                        onClick={handleCopyCredentials}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar datos</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-700">
                      <p>
                        <strong className="text-slate-900">Nombre:</strong> {successData.student.name}
                      </p>
                      <p>
                        <strong className="text-slate-900">Email:</strong> {successData.student.email}
                      </p>
                      <p className="flex items-center gap-2">
                        <strong className="text-slate-900">Contraseña inicial:</strong>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-indigo-600">
                          {successData.initialPassword}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Notice about password & Google */}
                  <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
                    <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                      <ShieldCheck className="w-4 h-4 text-amber-600" /> Primer acceso del alumno:
                    </p>
                    <p className="text-amber-700 leading-relaxed">
                      El alumno puede pulsar directamente el botón del correo recibido. En el propio mensaje se le informa de que puede cambiar esta contraseña provisional en cualquier momento desde <strong>&ldquo;Mi perfil&rdquo;</strong>, o acceder con <strong>Google</strong> con el mismo correo.
                    </p>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                    <button
                      onClick={handleCloseModal}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={() => {
                        const sid = successData.student.id;
                        handleCloseModal();
                        onSelectStudentForBooking(sid);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs  transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      <span>Asignar Primera Clase</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Form View */
                <form onSubmit={handleCreateStudent} className="space-y-5">
                  {formError && (
                    <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre y Apellidos *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ej. Sofía Martínez Ruiz"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Ej. sofia.martinez@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Teléfono Móvil (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Ej. +34 612 345 678"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Initial Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Contraseña Provisional *
                      </label>
                      <button
                        type="button"
                        onClick={() => setPassword(generateRandomPassword())}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generar otra</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Informational Callout Box */}
                  <div className="p-3.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-indigo-900">
                          Notificación de alta por correo electrónico:
                        </p>
                        <div className="space-y-1 text-slate-600">
                          <p>
                            El alumno recibirá un correo con instrucciones para acceder por primera vez a la Plataforma.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                      {submitting ? 'Dando de alta y enviando correo...' : 'Dar de alta y enviar acceso'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseEdit();
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Editar Alumno</h3>
                <p className="text-xs text-slate-500">Modifica datos del alumno o su estado</p>
              </div>
              <button onClick={handleCloseEdit} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4">
              {editError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre y Apellidos *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teléfono Móvil
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Change Password (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Establecer Nueva Contraseña (Opcional)
                </label>
                <div className="relative">
                  <input
                    type={editShowPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Dejar en blanco para no modificar"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword(!editShowPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mínimo 6 caracteres. Si se introduce una nueva, sustituirá a la actual.
                </p>
              </div>

              {/* Active / Inactive Status */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={e => setEditIsActive(e.target.checked)}
                    className="mt-0.5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Alumno activo para clases y reservas
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block">
                      Si se desmarca, el alumno pasará a estado &ldquo;Baja&rdquo;, se cancelarán sus reservas futuras pendientes y no podrá iniciar sesión.
                    </span>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {editSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / BAJA CONFIRMATION MODAL */}
      {deletingStudent && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseDelete();
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>
                  {(deletingStudent.total_bookings || 0) > 0 ? 'Dar de baja alumno' : 'Eliminar alumno'}
                </span>
              </h3>
              <button onClick={handleCloseDelete} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <p>
                  <strong>Alumno:</strong> {deletingStudent.name}
                </p>
                <p>
                  <strong>Email:</strong> {deletingStudent.email}
                </p>
                <p>
                  <strong>Clases registradas:</strong> {deletingStudent.total_bookings || 0} (
                  {deletingStudent.completed_classes || 0} completadas,{' '}
                  {deletingStudent.active_classes || 0} activas)
                </p>
              </div>

              {(deletingStudent.total_bookings || 0) > 0 ? (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <p className="font-bold text-amber-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    Protección de historial de la autoescuela
                  </p>
                  <p className="leading-relaxed text-amber-800">
                    Este alumno cuenta con clases prácticas cursadas. Para no desvirtuar las estadísticas de los profesores y mantener el historial contable, el alumno <strong>se dará de baja</strong>:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-amber-800">
                    <li>Se cancelarán automáticamente sus clases futuras pendientes.</li>
                    <li>Se inhabilitará su acceso al portal.</li>
                    <li>Se conservará todo su registro de clases ya completadas.</li>
                  </ul>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                  <p className="font-bold text-rose-950">Eliminación física definitiva</p>
                  <p className="leading-relaxed">
                    Este alumno no tiene ninguna clase práctica asociada en el sistema. Se eliminará de forma <strong>permanente e irreversible</strong>.
                  </p>
                </div>
              )}

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
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white  transition-colors ${(deletingStudent.total_bookings || 0) > 0
                    ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300'
                    : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
                    }`}
                >
                  {deleteSubmitting
                    ? 'Procesando...'
                    : (deletingStudent.total_bookings || 0) > 0
                      ? 'Dar de baja y proteger histórico'
                      : 'Eliminar definitivamente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
