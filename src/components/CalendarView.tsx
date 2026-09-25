import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import type { Booking, Teacher, ScheduleBlock } from '../types.ts';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Car,
  Filter,
  Ban,
  CalendarPlus,
} from 'lucide-react';

interface CalendarViewProps {
  onNavigateToBook?: () => void;
}

export default function CalendarView({ onNavigateToBook }: CalendarViewProps) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split('T')[0]);

  // Filters
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tRes, bRes, blRes] = await Promise.all([
        api.getTeachers(),
        api.getBookings(isAdmin ? { teacher_id: selectedTeacherId || undefined } : { student_id: user?.id }),
        isAdmin ? api.getBlocks(undefined, selectedTeacherId || undefined) : Promise.resolve({ blocks: [] }),
      ]);
      setTeachers(tRes.teachers);
      setBookings(bRes.bookings);
      setBlocks(blRes.blocks);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedTeacherId]);

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

  // Calendar calculations
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  const startingDayOffset = (firstDayOfWeek + 6) % 7;

  // Group bookings & blocks by date
  const bookingsByDate: Record<string, Booking[]> = {};
  bookings.forEach(b => {
    if (!bookingsByDate[b.date]) bookingsByDate[b.date] = [];
    bookingsByDate[b.date].push(b);
  });

  const blocksByDate: Record<string, ScheduleBlock[]> = {};
  blocks.forEach(b => {
    if (!blocksByDate[b.date]) blocksByDate[b.date] = [];
    blocksByDate[b.date].push(b);
  });

  const selectedDayBookings = bookingsByDate[selectedDate] || [];
  const selectedDayBlocks = blocksByDate[selectedDate] || [];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatted = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Calendar Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isAdmin ? 'Calendario general de clases' : 'Mi calendario de prácticas'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Vista interactiva mensual y diaria de las clases impartidas y bloqueos.'
              : 'Visualiza en qué días tienes clases reservadas.'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
              >
                <option value="">Todos los profesores</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isAdmin && onNavigateToBook && (

            <button
              onClick={onNavigateToBook}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold  transition-colors shrink-0"
            >
              <CalendarPlus className="w-4 h-4" /> Reservar clase
            </button>

          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MONTH CALENDAR (2 Cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              {new Date(currentYear, currentMonth - 1, 1)
                .toLocaleDateString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })
                .replace(/^./, (char) => char.toUpperCase())}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 py-1">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mié</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sáb</span>
            <span>Dom</span>
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: startingDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 rounded-lg opacity-0" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === today.toISOString().split('T')[0];
              const dayBookings = bookingsByDate[dateStr] || [];
              const dayBlocks = blocksByDate[dateStr] || [];

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-20 rounded-lg p-1.5 text-left flex flex-col justify-between border transition-all ${isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold rounded-lg px-1.5 py-0.5 ${isToday
                        ? 'bg-indigo-600 text-white'
                        : isSelected
                          ? 'text-indigo-700'
                          : 'text-slate-700'
                        }`}
                    >
                      {dayNum}
                    </span>
                  </div>

                  {/* Badges / indicators */}
                  <div className="space-y-0.5 w-full">
                    {dayBookings.length > 0 && (
                      <span className="block truncate text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        {dayBookings.length} {dayBookings.length === 1 ? 'clase' : 'clases'}
                      </span>
                    )}

                    {dayBlocks.length > 0 && (
                      <span className="block truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800">
                        Bloqueo
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SELECTED DAY DETAIL PANEL (1 Col on lg) */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col h-full">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
              Detalle del Día
            </span>
            <h4 className="font-extrabold text-base text-slate-900 mt-0.5">
              {formatDate(selectedDate)}
            </h4>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto space-y-3">
            {/* Blocks */}
            {selectedDayBlocks.map(block => (
              <div
                key={block.id}
                className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  <span>
                    Bloqueo:{' '}
                    {block.is_full_day ? 'Día completo' : `${block.start_time} - ${block.end_time}`}
                  </span>
                </div>
                <p className="text-xs text-rose-700 mt-1">{block.reason}</p>
              </div>
            ))}

            {/* Bookings */}
            {selectedDayBookings.length === 0 && selectedDayBlocks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No hay clases ni eventos programados para este día.
              </div>
            ) : (
              selectedDayBookings.map(b => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> {b.start_time} - {b.end_time}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === 'Reservada'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status.startsWith('Cancelada')
                          ? 'bg-rose-100 text-rose-800'
                          : b.status === 'No presentado'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5">
                    {isAdmin && (
                      <p>
                        Alumno: <strong>{b.student_name}</strong>
                      </p>
                    )}
                    <p>
                      Profesor: <strong>{b.teacher_name}</strong>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
