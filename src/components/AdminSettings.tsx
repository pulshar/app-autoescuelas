import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import type { AppSettings, ReminderLogItem, ResendStatus } from '../types.ts';
import {
  Clock,
  Car,
  Ban,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  Sparkles,
  RotateCcw,
  Tag,
  Smartphone,
  Mail,
  MapPin,
  History,
  Play,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Sliders,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

const DEFAULT_TITLE_TEMPLATE = 'Recordatorio: Clase práctica - {fecha} a las {hora}';
const DEFAULT_MESSAGE_TEMPLATE =
  'Hola {alumno}, te recordamos tu clase práctica de conducir con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!';
const DEFAULT_LOCATION_TEXT = 'Sede Central Autoescuela (Av. de la Constitución, 12)';

const VARIABLE_TAGS = [
  { tag: '{alumno}', label: 'Nombre Alumno', desc: 'Carlos Gómez' },
  { tag: '{profesor}', label: 'Profesor', desc: 'Manuel Serrano' },
  { tag: '{fecha}', label: 'Fecha', desc: '24/09/2026' },
  { tag: '{hora}', label: 'Hora', desc: '10:00' },
  { tag: '{duracion}', label: 'Duración', desc: '45 min' },
  { tag: '{ubicacion}', label: 'Punto de encuentro', desc: 'Sede Central' },
  { tag: '{autoescuela}', label: 'Autoescuela', desc: 'AutoescuelaPro' },
];

const PRESET_HOURS = [
  { hours: 2, label: '2 horas antes', sub: 'Última hora' },
  { hours: 6, label: '6 horas antes', sub: 'Mismo día' },
  { hours: 12, label: '12 horas antes', sub: 'Medio día' },
  { hours: 24, label: '24 horas antes', sub: '1 día antes (Recomendado)', recommended: true },
  { hours: 48, label: '48 horas antes', sub: '2 días antes' },
];

export default function AdminSettings() {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'reminders' | 'general'>('reminders');
  const [previewTab, setPreviewTab] = useState<'app' | 'email'>('email');
  const [loading, setLoading] = useState(true);

  // Form State: General & Identity Settings
  const [schoolName, setSchoolName] = useState<string>('AutoescuelaPro');
  const [classDuration, setClassDuration] = useState<number>(45);
  const [restTime, setRestTime] = useState<number>(0);
  const [minCancellationHours, setMinCancellationHours] = useState<number>(24);
  const [timezone, setTimezone] = useState<string>('Europe/Madrid');

  // Form State: Automatic Reminders Settings
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [reminderHoursBefore, setReminderHoursBefore] = useState<number>(24);
  const [reminderChannel, setReminderChannel] = useState<'both' | 'app' | 'email'>('both');
  const [reminderTitleTemplate, setReminderTitleTemplate] = useState<string>(DEFAULT_TITLE_TEMPLATE);
  const [reminderMessageTemplate, setReminderMessageTemplate] = useState<string>(DEFAULT_MESSAGE_TEMPLATE);
  const [reminderIncludeLocation, setReminderIncludeLocation] = useState<boolean>(true);
  const [reminderLocationText, setReminderLocationText] = useState<string>(DEFAULT_LOCATION_TEXT);

  // Tracking focused field for quick variable tag insertion
  const [lastFocusedField, setLastFocusedField] = useState<'title' | 'message'>('message');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Resend status & test email recipient
  const [resendStatus, setResendStatus] = useState<ResendStatus | null>(null);
  const [testRecipient, setTestRecipient] = useState<string>(
    user?.email && !user.email.includes('example.com') ? user.email : 'alvaroq.dev@gmail.com'
  );
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Feedback & Action states
  const [saving, setSaving] = useState(false);
  const [testingReminder, setTestingReminder] = useState(false);
  const [processingReminders, setProcessingReminders] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Reminders Log
  const [remindersLog, setRemindersLog] = useState<ReminderLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      const s = res.settings;
      setSchoolName(s.school_name || 'AutoescuelaPro');
      setClassDuration(s.class_duration_minutes ?? 45);
      setRestTime(s.rest_time_minutes ?? 0);
      setMinCancellationHours(s.min_cancellation_hours ?? 24);
      setReminderEnabled(s.reminder_enabled ?? true);
      setReminderHoursBefore(s.reminder_hours_before ?? 24);
      setReminderChannel(s.reminder_channel ?? 'both');
      setReminderTitleTemplate(s.reminder_title_template || DEFAULT_TITLE_TEMPLATE);
      setReminderMessageTemplate(s.reminder_message_template || DEFAULT_MESSAGE_TEMPLATE);
      setReminderIncludeLocation(s.reminder_include_location ?? true);
      setReminderLocationText(s.reminder_location_text || DEFAULT_LOCATION_TEXT);
      setTimezone(s.timezone || 'Europe/Madrid');
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setFeedback({ type: 'error', message: 'Error al cargar la configuración: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchResendStatus = async () => {
    try {
      const status = await api.getResendStatus();
      setResendStatus(status);
      if (status.isSandbox && status.authorizedTestEmail) {
        setTestRecipient(status.authorizedTestEmail);
      }
    } catch (err) {
      console.error('Error fetching Resend status:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.getRemindersLog();
      setRemindersLog(res.reminders || []);
    } catch (err) {
      console.error('Error fetching reminders log:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchResendStatus();
    fetchLogs();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await api.updateSettings({
        school_name: schoolName.trim() || 'AutoescuelaPro',
        class_duration_minutes: Number(classDuration),
        rest_time_minutes: Number(restTime),
        min_cancellation_hours: Number(minCancellationHours),
        reminder_enabled: reminderEnabled,
        reminder_hours_before: Number(reminderHoursBefore),
        reminder_channel: reminderChannel,
        reminder_title_template: reminderTitleTemplate.trim(),
        reminder_message_template: reminderMessageTemplate.trim(),
        reminder_include_location: reminderIncludeLocation,
        reminder_location_text: reminderLocationText.trim(),
        timezone,
      });

      setFeedback({
        type: 'success',
        message: res.message || 'Configuración guardada correctamente.',
      });
      // Notify other components like Navbar about the new school name
      window.dispatchEvent(
        new CustomEvent('app-settings-updated', {
          detail: { school_name: schoolName.trim() || 'AutoescuelaPro' },
        })
      );
      fetchLogs();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al guardar la configuración.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    if (lastFocusedField === 'title') {
      const input = titleInputRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newValue =
          reminderTitleTemplate.substring(0, start) +
          tag +
          reminderTitleTemplate.substring(end);
        setReminderTitleTemplate(newValue);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setReminderTitleTemplate(prev => prev + ' ' + tag);
      }
    } else {
      const textarea = messageTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const newValue =
          reminderMessageTemplate.substring(0, start) +
          tag +
          reminderMessageTemplate.substring(end);
        setReminderMessageTemplate(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setReminderMessageTemplate(prev => prev + ' ' + tag);
      }
    }
  };

  const handleResetTemplates = () => {
    setReminderTitleTemplate(DEFAULT_TITLE_TEMPLATE);
    setReminderMessageTemplate(DEFAULT_MESSAGE_TEMPLATE);
    setReminderLocationText(DEFAULT_LOCATION_TEXT);
    setFeedback({
      type: 'info',
      message: 'Se han restaurado los textos y plantillas por defecto. Recuerda pulsar "Guardar Todo".',
    });
  };

  useEffect(() => {
    if (resendStatus?.isSandbox && resendStatus.authorizedTestEmail) {
      setTestRecipient(resendStatus.authorizedTestEmail);
    } else if (user?.email && !user.email.includes('example.com')) {
      setTestRecipient(user.email);
    }
  }, [user?.email, resendStatus?.isSandbox, resendStatus?.authorizedTestEmail]);

  const handleSendTestEmail = async () => {
    const targetEmail = testRecipient.trim() || 'alvaroq.dev@gmail.com';
    try {
      setTestingEmail(true);
      setEmailFeedback(null);
      const res = await api.sendTestEmail(targetEmail);
      setEmailFeedback({
        success: true,
        message: res.message || `Correo real enviado con éxito a ${res.recipient} vía Resend.`,
      });
      fetchResendStatus();
    } catch (err: any) {
      setEmailFeedback({
        success: false,
        message: err.message || 'Error al conectar con la API de Resend.',
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setTestingReminder(true);
      setFeedback(null);
      const res = await api.testReminderNotification({
        title_template: reminderTitleTemplate,
        message_template: reminderMessageTemplate,
        location_text: reminderLocationText,
        include_location: reminderIncludeLocation,
      });
      setFeedback({
        type: 'success',
        message: res.message || 'Notificación de prueba enviada con éxito.',
      });
      fetchLogs();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Error al enviar notificación de prueba: ' + (err.message || 'desconocido'),
      });
    } finally {
      setTestingReminder(false);
    }
  };

  const handleProcessRemindersNow = async () => {
    try {
      setProcessingReminders(true);
      setFeedback(null);
      const res = await api.processAutomaticReminders();
      setFeedback({
        type: res.sent > 0 ? 'success' : 'info',
        message: res.message,
      });
      fetchLogs();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Error al ejecutar la revisión: ' + (err.message || 'desconocido'),
      });
    } finally {
      setProcessingReminders(false);
    }
  };

  // Generate live sample preview text
  const currentSchoolName = schoolName.trim() || 'AutoescuelaPro';
  const previewTitle = reminderTitleTemplate
    .replace(/{alumno}/g, 'Carlos Gómez')
    .replace(/{profesor}/g, 'Manuel Serrano')
    .replace(/{fecha}/g, '24/09/2026')
    .replace(/{hora}/g, '10:00')
    .replace(/{duracion}/g, '45')
    .replace(/{ubicacion}/g, reminderLocationText)
    .replace(/{autoescuela}/g, currentSchoolName);

  let previewMessage = reminderMessageTemplate
    .replace(/{alumno}/g, 'Carlos Gómez')
    .replace(/{profesor}/g, 'Manuel Serrano')
    .replace(/{fecha}/g, '24/09/2026')
    .replace(/{hora}/g, '10:00')
    .replace(/{duracion}/g, '45')
    .replace(/{ubicacion}/g, reminderLocationText)
    .replace(/{autoescuela}/g, currentSchoolName);

  if (reminderIncludeLocation && reminderLocationText && !previewMessage.includes(reminderLocationText)) {
    previewMessage += ` Punto de encuentro: ${reminderLocationText}.`;
  }

  const getHumanDuration = (hrs: number) => {
    if (hrs < 24) return `${hrs} horas antes de la clase`;
    const days = Math.floor(hrs / 24);
    const remHours = hrs % 24;
    if (remHours === 0) {
      return `${days} ${days === 1 ? 'día' : 'días'} antes de la clase (${hrs}h)`;
    }
    return `${days}d y ${remHours}h antes (${hrs}h)`;
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Configuración del administrador
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sliders className="w-3 h-3" /> Parámetros
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configura el tiempo de antelación, contenidos de recordatorios automáticos de clases, entrega por email con Resend y políticas de la autoescuela.
            </p>
          </div>

          {/* Master quick save */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-xs sm:text-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('reminders')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${activeSubTab === 'reminders'
              ? 'bg-indigo-600 text-white  shadow-indigo-200'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
          >
            <Bell className="w-4 h-4" />
            <span>Recordatorios y correo (Resend)</span>
            {reminderEnabled ? (
              <span
                className={`w-2 h-2 rounded-full ${activeSubTab === 'reminders' ? 'bg-emerald-300' : 'bg-emerald-500'
                  } animate-pulse`}
              />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('general')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${activeSubTab === 'general'
              ? 'bg-indigo-600 text-white  shadow-indigo-200'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
          >
            <Clock className="w-4 h-4" />
            <span>Horarios y políticas generales</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg text-xs sm:text-sm flex items-start justify-between gap-3 border ${feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {feedback.type === 'info' && <Info className="w-5 h-5 text-sky-600 shrink-0" />}
            <span className="font-medium leading-relaxed">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold shrink-0 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm animate-pulse bg-white rounded-xl border border-slate-200">
          Cargando configuración de la autoescuela...
        </div>
      ) : activeSubTab === 'reminders' ? (
        /* ================================================================= */
        /* PANEL DE RECORDATORIOS AUTOMÁTICOS Y CORREOS RESEND               */
        /* ================================================================= */
        <div className="space-y-6">
          {/* Card 0: Resend Service Integration Status */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${resendStatus?.configured
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                    }`}
                >
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-slate-900">
                      Servicio de correo transaccional (Resend)
                    </h3>
                    {resendStatus?.configured ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" /> Configurado
                        </span>
                        {resendStatus.isSandbox && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Info className="w-3 h-3 text-amber-600" /> Sandbox activo
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Pendiente de API Key
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Envío automático y bajo demanda de correos electrónicos con diseño profesional y datos de cada clase.
                  </p>
                </div>
              </div>

              {/* Real Email Test Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <div className="relative">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="tucorreo@gmail.com"
                    title="Dirección donde se enviará el correo de prueba"
                    className="w-full sm:w-60 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                  />
                  {resendStatus?.isSandbox && resendStatus.authorizedTestEmail && testRecipient !== resendStatus.authorizedTestEmail && (
                    <button
                      type="button"
                      onClick={() => setTestRecipient(resendStatus.authorizedTestEmail!)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-semibold block mt-1"
                    >
                      Usar dirección autorizada ({resendStatus.authorizedTestEmail})
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testingEmail || !testRecipient.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold shadow-xs transition-all shrink-0 self-start"
                >
                  <Send className={`w-3.5 h-3.5 ${testingEmail ? 'animate-pulse' : ''}`} />
                  <span>{testingEmail ? 'Enviando...' : 'Enviar prueba'}</span>
                </button>
              </div>
            </div>

            {/* Email Test Feedback Banner */}
            {emailFeedback && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-center justify-between border ${emailFeedback.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
              >
                <div className="flex items-center gap-2">
                  {emailFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{emailFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Resend details or instructions */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/70 text-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700">Remitente actual:</span>{' '}
                  <code className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono text-[11px] text-slate-800">
                    {resendStatus?.sender || `${currentSchoolName} <onboarding@resend.dev>`}
                  </code>
                </div>
                <div className="text-slate-500 text-[11px]">
                  Proveedor: <strong>Resend API (SDK oficial v4)</strong>
                </div>
              </div>

              {resendStatus?.isSandbox && (
                <div className="pt-2 border-t border-slate-200/60 text-slate-600 text-[11px] leading-relaxed">
                  ℹ️ <strong>Modo Sandbox (Pruebas) de Resend:</strong> Al usar <code>onboarding@resend.dev</code>, la política de Resend entrega los correos a tu dirección registrada (<strong>{resendStatus.authorizedTestEmail || 'alvaroq.dev@gmail.com'}</strong>). El sistema maneja esto de forma automática para que puedas probar el diseño sin fallos. Para enviar directamente a cualquier dirección externa de alumnos, verifica tu dominio en <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">resend.com/domains <ExternalLink className="w-2.5 h-2.5" /></a> y configura la variable <code className="bg-white px-1 py-0.5 rounded border font-mono">RESEND_FROM_EMAIL</code>.
                </div>
              )}

              {!resendStatus?.configured && (
                <div className="pt-2 border-t border-slate-200/60 text-slate-600 text-[11px] leading-relaxed">
                  💡 <strong>¿Cómo activar el envío real?</strong> Accede al menú de <em>Settings &gt; Secrets / Variables de Entorno</em> en AI Studio y define <code className="bg-white px-1.5 py-0.5 rounded border font-mono">RESEND_API_KEY</code> con tu clave de <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">resend.com <ExternalLink className="w-2.5 h-2.5" /></a>. Mientras tanto, el sistema generará los avisos en la aplicación web sin interrumpir tu operativa.
                </div>
              )}
            </div>
          </div>

          {/* Card 1: Master Enable Toggle & Channels */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${reminderEnabled
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-400'
                    }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">
                    Automatización de recordatorios
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Envía avisos automáticos a los alumnos antes de cada clase práctica para garantizar la asistencia puntual.
                  </p>
                </div>
              </div>

              {/* Master Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => setReminderEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs sm:text-sm font-semibold text-slate-800">
                  {reminderEnabled ? 'Activo' : 'Desactivado'}
                </span>
              </label>
            </div>

            {/* Channels & Delivery Options */}
            <div>
              <label className="block font-mono text-slate-500 mb-2">
                Canal de Entrega
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setReminderChannel('both')}
                  className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all ${reminderChannel === 'both'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${reminderChannel === 'both'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      App + Correo
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-700 font-semibold">
                        Recomendado
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Campana web y correo con Resend
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReminderChannel('app')}
                  className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all ${reminderChannel === 'app'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${reminderChannel === 'app'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-900">Solo en la App</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Aviso en la campana y panel web
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReminderChannel('email')}
                  className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all ${reminderChannel === 'email'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${reminderChannel === 'email'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-900">Solo Correo</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Envío directo al buzón del alumno
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Advance Time Configuration (Tiempo de Antelación) */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  Tiempo de antelación del recordatorio
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  ¿Con cuánta antelación deben recibir los alumnos la notificación antes de que empiece su clase práctica?
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {PRESET_HOURS.map(preset => {
                  const isSelected = Number(reminderHoursBefore) === preset.hours;
                  return (
                    <button
                      key={preset.hours}
                      type="button"
                      onClick={() => setReminderHoursBefore(preset.hours)}
                      className={`p-3 rounded-lg border text-center transition-all relative ${isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-600/20 text-indigo-900'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                        }`}
                    >
                      {preset.recommended && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                          Popular
                        </span>
                      )}
                      <div className="font-bold text-sm sm:text-base">{preset.hours}h</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{preset.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Antelación personalizada (en horas)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={reminderHoursBefore}
                    onChange={e => setReminderHoursBefore(Math.max(1, Number(e.target.value)))}
                    className="w-28 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-500">horas antes del inicio</span>
                </div>
              </div>

              <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Disparo programado: <strong>{getHumanDuration(reminderHoursBefore)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Notification Content & Template (Contenido de las Notificaciones) */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">
                    Contenido y plantilla de los mensajes
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Personaliza el título y texto del recordatorio insertando etiquetas dinámicas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetTemplates}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar predeterminados</span>
              </button>
            </div>

            {/* Variable Tags Selector */}
            <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Variables disponibles (Haz clic para insertar en el texto):
                </span>
                <span className="text-[11px] text-slate-400">
                  Campo activo:{' '}
                  <strong className="text-indigo-600">
                    {lastFocusedField === 'title' ? 'Título' : 'Mensaje'}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {VARIABLE_TAGS.map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertTag(v.tag)}
                    title={`Insertar ${v.tag} (ejemplo: ${v.desc})`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-mono bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs transition-all"
                  >
                    <span>{v.tag}</span>
                    <span className="text-[10px] font-sans font-normal text-slate-400">({v.label})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Title Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Título de la Notificación / Asunto del Correo
                </label>
                <span className="text-[11px] text-slate-400">
                  {reminderTitleTemplate.length} caracteres
                </span>
              </div>
              <input
                ref={titleInputRef}
                type="text"
                value={reminderTitleTemplate}
                onFocus={() => setLastFocusedField('title')}
                onChange={e => setReminderTitleTemplate(e.target.value)}
                placeholder="Ej: Recordatorio: Clase práctica - {fecha} a las {hora}"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Notification Message Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Mensaje / Cuerpo del Recordatorio
                </label>
                <span className="text-[11px] text-slate-400">
                  {reminderMessageTemplate.length} caracteres
                </span>
              </div>
              <textarea
                ref={messageTextareaRef}
                rows={4}
                value={reminderMessageTemplate}
                onFocus={() => setLastFocusedField('message')}
                onChange={e => setReminderMessageTemplate(e.target.value)}
                placeholder="Escribe el mensaje que recibirá el alumno..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
              />
            </div>

            {/* Location & Meeting point options */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeLocation"
                  checked={reminderIncludeLocation}
                  onChange={e => setReminderIncludeLocation(e.target.checked)}
                  className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="includeLocation" className="text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer">
                  Incluir punto de encuentro o dirección de salida en el recordatorio
                </label>
              </div>

              {reminderIncludeLocation && (
                <div className="pl-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={reminderLocationText}
                      onChange={e => setReminderLocationText(e.target.value)}
                      placeholder="Dirección o punto de encuentro..."
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Se añadirá automáticamente al final del mensaje o se insertará donde coloques la variable {'{ubicacion}'}.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Live Previews (Tabbed: Email HTML vs App Notification) */}
          <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-7 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-rose-400" />
                <h4 className="font-bold text-sm sm:text-base tracking-wide">
                  Vista previa en tiempo real
                </h4>
              </div>

              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewTab('email')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${previewTab === 'email'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                    }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Correo Electrónico (Resend)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('app')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${previewTab === 'app'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                    }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Campana en la App
                </button>
              </div>
            </div>

            {previewTab === 'email' ? (
              /* EMAIL PREVIEW MOCKUP */
              <div className="bg-slate-100 text-slate-900 rounded-lg p-3 sm:p-6 shadow-inner">
                <div className="max-w-md mx-auto bg-white rounded-lg border border-slate-200 shadow-md overflow-hidden text-left">
                  {/* Brand Header */}
                  <div className="bg-[#da1249] p-5 text-white">
                    <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5">
                      {currentSchoolName}
                    </span>
                    <h5 className="font-bold text-base leading-snug">
                      Recordatorio de tu próxima clase práctica
                    </h5>
                  </div>

                  {/* Email Body */}
                  <div className="p-5 space-y-4 text-xs">
                    <p className="text-slate-700">
                      Hola <strong>Carlos Gómez</strong>,
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      {previewMessage}
                    </p>

                    {/* Class Details Box */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-1.5 font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Fecha:</span>
                        <span className="font-bold text-slate-800">24/09/2026</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hora:</span>
                        <span className="font-extrabold text-[#da1249]">10:00 (45 min)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Profesor:</span>
                        <span className="font-bold text-slate-800">Manuel Serrano</span>
                      </div>
                      {reminderIncludeLocation && reminderLocationText && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Salida:</span>
                          <span className="font-semibold text-slate-700 text-right">{reminderLocationText}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-center">
                      <span className="inline-block bg-[#da1249] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs">
                        Ver mis clases en la plataforma
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                      {currentSchoolName} • Correo enviado automáticamente mediante Resend
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* APP NOTIFICATION PREVIEW MOCKUP */
              <div className="bg-white text-slate-900 rounded-lg p-4 sm:p-5 shadow-xl border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {previewTitle}
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                        Ahora
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {previewMessage}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{currentSchoolName} • Recordatorios</span>
                      <span className="font-medium text-slate-500">Antelación: {reminderHoursBefore}h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Las etiquetas dinámicas se sustituyen automáticamente por el alumno, profesor y detalles reales de cada reserva en el momento del envío.
            </p>
          </div>

          {/* Card 5: Testing, Manual Execution & History */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Play className="w-5 h-5 text-indigo-600" /> Pruebas y acciones del sistema
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Test Button */}
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testingReminder}
                className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-left transition-all group flex items-start gap-3"
              >
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white group-hover:scale-105 transition-transform shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-900">
                    {testingReminder ? 'Enviando prueba...' : 'Disparar notificación de prueba'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Recibe una notificación con la plantilla actual en tu campana de usuario.
                  </div>
                </div>
              </button>

              {/* Force Processing Button */}
              <button
                type="button"
                onClick={handleProcessRemindersNow}
                disabled={processingReminders}
                className="p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all group flex items-start gap-3"
              >
                <div className="p-2.5 rounded-xl bg-slate-800 text-white group-hover:scale-105 transition-transform shrink-0">
                  <RefreshCw className={`w-4 h-4 ${processingReminders ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-900">
                    {processingReminders ? 'Buscando clases...' : 'Revisar y enviar recordatorios ahora'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Escanea reservas en las próximas {reminderHoursBefore}h y envía recordatorios pendientes.
                  </div>
                </div>
              </button>
            </div>

            {/* Quick reminder log overview */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-800">
                    Registro de Recordatorios Emitidos
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                    {remindersLog.length} registrados
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              {remindersLog.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-slate-100">
                  Aún no se han emitido recordatorios automáticos. Se generarán automáticamente según el horario programado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  {remindersLog.slice(0, 5).map(log => (
                    <div key={log.id} className="p-3 bg-white hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">
                          {log.student_name || 'Alumno'} {log.student_email ? `(${log.student_email})` : ''}
                        </span>
                        <span className="text-slate-400">
                          {new Date(log.created_at).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                        {log.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ================================================================= */
        /* PANEL DE HORARIOS, DURACIÓN Y POLÍTICAS GENERALES                  */
        /* ================================================================= */
        <div className="space-y-6">
          {/* Identidad y Nombre de la Autoescuela */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                Nombre comercial de la autoescuela
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Marca pública
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la autoescuela / plataforma
              </label>
              <div className="max-w-md">
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  placeholder="Ej. Autoescuela San Cristóbal, AutoescuelaPro..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Este nombre sustituye al término <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">AutoescuelaPro</code> en toda la aplicación: en el logotipo de la barra de navegación superior, en los emails de bienvenida a nuevos alumnos, en los recordatorios automáticos (Resend) y en la etiqueta variable <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">{'{autoescuela}'}</code>.
              </p>
            </div>

            {/* Live brand preview badge */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  Vista previa en la barra superior
                </span>
                <span className="text-sm font-extrabold text-slate-900">
                  {currentSchoolName}
                </span>
              </div>
            </div>
          </div>
          {/* Duración y Descansos */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Duración y descansos de clases
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duración de cada clase práctica (minutos)
                </label>
                <select
                  value={classDuration}
                  onChange={e => setClassDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold bg-white"
                >
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos (Estándar DGT)</option>
                  <option value={50}>50 minutos</option>
                  <option value={60}>60 minutos (1 hora)</option>
                  <option value={90}>90 minutos (Clase doble)</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Los slots se generarán dividiendo las franjas de la agenda según esta duración.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiempo de descanso/desplazamiento entre clases (minutos)
                </label>
                <select
                  value={restTime}
                  onChange={e => setRestTime(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold bg-white"
                >
                  <option value={0}>0 minutos (Clases continuas)</option>
                  <option value={5}>5 minutos</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Margen de separación antes de la siguiente clase.
                </span>
              </div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" /> Política de cancelación
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Antelación mínima para cancelar por el alumno (horas)
              </label>
              <div className="max-w-xs">
                <input
                  type="number"
                  min={1}
                  max={72}
                  required
                  value={minCancellationHours}
                  onChange={e => setMinCancellationHours(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 block leading-relaxed">
                Si un alumno intenta cancelar una clase con menos de esta antelación, el sistema impedirá
                la cancelación automática y le solicitará contactar con secretaría.
              </span>
            </div>
          </div>

          {/* Timezone */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Zona horaria operativa
            </h3>

            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Zona horaria de la autoescuela
              </label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold bg-white"
              >
                <option value="Europe/Madrid">Europe/Madrid (Península y Baleares)</option>
                <option value="Atlantic/Canary">Atlantic/Canary (Islas Canarias)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save bar */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <span className="text-xs text-slate-400">
          Los cambios surtirán efecto de inmediato en todas las reservas futuras y recordatorios.
        </span>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-xs sm:text-sm transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Guardando configuración...' : 'Guardar cambios'}</span>
        </button>
      </div>
    </div>
  );
}
