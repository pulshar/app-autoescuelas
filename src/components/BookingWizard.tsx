import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import type { Teacher, TimeSlot, AppSettings } from '../types.ts';
import {
  User,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface BookingWizardProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function BookingWizard({ onSuccess, onCancel }: BookingWizardProps) {
  const { user } = useAuth();

  // Wizard state: 1 (Teacher), 2 (Date), 3 (Slot), 4 (Confirm)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Data
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Selections
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | ''>(''); // '' = any
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState<string>('');

  // Calendar month state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [monthAvailability, setMonthAvailability] = useState<Record<string, { total: number; available: number }>>({});

  // Slots for selected date
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Fetch initial teachers & settings
  useEffect(() => {
    async function loadInitial() {
      try {
        const [tRes, sRes] = await Promise.all([
          api.getTeachers(),
          api.getSettings(),
        ]);
        setTeachers(tRes.teachers.filter(t => t.is_active));
        setSettings(sRes.settings);
      } catch (err) {
        console.error('Error loading booking data:', err);
      }
    }
    loadInitial();
  }, []);

  // Fetch calendar availability when month/teacher changes
  useEffect(() => {
    async function loadAvailability() {
      try {
        const res = await api.getCalendarAvailability(currentYear, currentMonth, selectedTeacherId || undefined);
        setMonthAvailability(res.availability);
      } catch (err) {
        console.error('Error loading month availability:', err);
      }
    }
    loadAvailability();
  }, [currentYear, currentMonth, selectedTeacherId]);

  // Fetch slots when date or teacher changes
  useEffect(() => {
    if (!selectedDate) return;
    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const res = await api.getSlots(selectedDate, selectedTeacherId || undefined);
        setSlots(res.slots);
      } catch (err) {
        console.error('Error loading slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [selectedDate, selectedTeacherId]);

  // Helper date formatting
  const formatDateSpanish = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Calendar rendering
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sunday
  // Adjust so 0 = Monday, 6 = Sunday (European standard)
  const startingDayOffset = (firstDayOfWeek + 6) % 7;

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSelectDate = (dateStr: string) => {
    if (dateStr < todayStr) return;
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setStep(3);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    if (!slot.is_available) return;
    setSelectedSlot(slot);
    setStep(4);
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedDate) return;
    setBookingLoading(true);
    setBookingError(null);

    try {
      await api.createBooking({
        teacher_id: selectedSlot.teacher_id,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        notes: notes.trim() || undefined,
      });

      onSuccess();
    } catch (err: any) {
      setBookingError(err.message || 'No se pudo completar la reserva. El horario pudo haber sido ocupado recientemente.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden max-w-3xl mx-auto">
      {/* Header & Step progress */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              Paso {step} de 4
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              {step === 1 && 'Selecciona tu Profesor'}
              {step === 2 && 'Elige la Fecha'}
              {step === 3 && 'Selecciona el Horario'}
              {step === 4 && 'Confirmar Reserva'}
            </h2>
          </div>

          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Volver
            </button>
          )}
        </div>

        {/* Stepper indicator */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${s <= step ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
            />
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* ======================================================== */}
        {/* STEP 1: PROFESOR */}
        {/* ======================================================== */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-600">
              ¿Tienes preferencia por algún profesor o prefieres ver la disponibilidad de cualquiera?
            </p>

            {/* "Any teacher" option */}
            <div
              onClick={() => {
                setSelectedTeacherId('');
                setStep(2);
              }}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between gap-4 ${selectedTeacherId === ''
                ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Cualquier profesor disponible</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mayor flexibilidad de horarios para reservar tus clases más pronto
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-indigo-600 shrink-0" />
            </div>

            {/* Teacher Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {teachers.map(teacher => (
                <div
                  key={teacher.id}
                  onClick={() => {
                    setSelectedTeacherId(teacher.id);
                    setStep(2);
                  }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedTeacherId === teacher.id
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {teacher.photo_url ? (
                      <img
                        src={teacher.photo_url}
                        alt={teacher.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {teacher.name[0]}
                        {teacher.last_name[0]}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {teacher.name} {teacher.last_name}
                      </h4>
                      {teacher.notes && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {teacher.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                    <span>Seleccionar profesor</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: FECHA (CALENDARIO) */}
        {/* ======================================================== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
              <button
                onClick={prevMonth}
                className="p-2 rounded-xl hover:bg-white text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 capitalize">
                {new Date(currentYear, currentMonth - 1, 1).toLocaleDateString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <button
                onClick={nextMonth}
                className="p-2 rounded-xl hover:bg-white text-slate-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 py-1">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Empty leading offset */}
              {Array.from({ length: startingDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14 rounded-xl opacity-0" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                const isPast = dateStr < todayStr;
                const isSelected = selectedDate === dateStr;
                const avail = monthAvailability[dateStr];
                const hasSlots = avail && avail.available > 0;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectDate(dateStr)}
                    className={`h-14 rounded-lg p-1 flex flex-col items-center justify-between transition-all relative ${isPast
                      ? 'opacity-30 cursor-not-allowed bg-slate-50 text-slate-400'
                      : isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-200'
                        : hasSlots
                          ? 'bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-900'
                          : 'bg-slate-50/80 border border-slate-100 text-slate-400 hover:bg-slate-100'
                      }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold">{dayNum}</span>

                    {!isPast && (
                      <div className="w-full flex justify-center pb-0.5">
                        {hasSlots ? (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold truncate max-w-full ${isSelected
                              ? 'bg-white text-indigo-700'
                              : 'bg-emerald-100 text-emerald-800'
                              }`}
                          >
                            {avail.available} {avail.available === 1 ? 'libre' : 'libres'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">0</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Días con plazas libres
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Sin disponibilidad
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: HORARIO (SLOTS) */}
        {/* ======================================================== */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-indigo-700 block">Fecha seleccionada</span>
                <p className="text-xs sm:text-sm font-bold text-slate-900 capitalize">
                  {formatDateSpanish(selectedDate)}
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
              >
                Cambiar día
              </button>
            </div>

            {loadingSlots ? (
              <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
                Calculando horarios disponibles según la agenda...
              </div>
            ) : slots.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No hay turnos disponibles para este día según el horario configurado.
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  Selecciona la hora que mejor se adapte a tu horario ({settings?.class_duration_minutes} minutos por clase):
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {slots.map((slot, index) => {
                    const isSelected =
                      selectedSlot?.start_time === slot.start_time &&
                      selectedSlot?.teacher_id === slot.teacher_id;

                    return (
                      <button
                        key={`${slot.teacher_id}-${slot.start_time}-${index}`}
                        type="button"
                        disabled={!slot.is_available}
                        onClick={() => handleSelectSlot(slot)}
                        className={`p-3 rounded-lg border text-left transition-all relative ${!slot.is_available
                          ? 'bg-slate-50/80 border-slate-200 opacity-60 cursor-not-allowed'
                          : isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                            : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-900'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-bold ${isSelected ? 'text-white' : slot.is_available ? 'text-slate-900' : 'text-slate-400'
                              }`}
                          >
                            {slot.start_time} - {slot.end_time}
                          </span>
                        </div>

                        <div className="mt-1 text-[11px] truncate">
                          {slot.is_available ? (
                            <span className={isSelected ? 'text-indigo-100' : 'text-slate-500'}>
                              {slot.teacher_name}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-medium">
                              {slot.reason_unavailable || 'No disponible'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: RESUMEN Y CONFIRMACIÓN */}
        {/* ======================================================== */}
        {step === 4 && selectedSlot && (
          <div className="space-y-5">
            {bookingError && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {/* Summary card */}
            <div className="bg-slate-50 rounded-xl p-5 sm:p-6 border border-slate-200 space-y-4">
              <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider text-indigo-700">
                Resumen de la Clase
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block">Profesor:</span>
                  <span className="text-sm font-bold text-slate-900">{selectedSlot.teacher_name}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Duración:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedSlot.duration_minutes} minutos
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Fecha:</span>
                  <span className="text-sm font-bold text-slate-900 capitalize">
                    {formatDateSpanish(selectedDate)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Horario:</span>
                  <span className="text-sm font-bold text-indigo-700">
                    {selectedSlot.start_time} a {selectedSlot.end_time}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas para el profesor (opcional):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej. Quiero practicar aparcamiento en batería o conducción en autovía..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Cancellation policy notice */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                <strong>Política de cancelación:</strong> Podrás cancelar tu clase de forma gratuita hasta{' '}
                <strong>{settings?.min_cancellation_hours || 24} horas antes</strong> del inicio de la misma.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Modificar Horario
              </button>

              <button
                type="button"
                disabled={bookingLoading}
                onClick={handleConfirmBooking}
                className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-2"
              >
                {bookingLoading ? (
                  <span>Confirmando reserva...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirmar Reserva</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
