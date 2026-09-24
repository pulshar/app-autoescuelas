import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import type { DashboardStats, Booking } from '../types.ts';
import {
  Calendar,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  Ban,
  CalendarPlus,
  PlusCircle,
  Settings,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenManualBooking: () => void;
  onOpenCreateTeacher: () => void;
  onOpenCreateBlock: () => void;
}

export default function AdminDashboard({
  onNavigate,
  onOpenManualBooking,
  onOpenCreateTeacher,
  onOpenCreateBlock,
}: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const [statsRes, bookingsRes] = await Promise.all([
        api.getStats(),
        api.getBookings({ date: todayStr }),
      ]);
      setStats(statsRes.stats);
      setTodayBookings(bookingsRes.bookings);
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Panel de Administración
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Gestión Integral de la Autoescuela
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Supervisa la ocupación de profesores, clases diarias y configuración de agendas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenManualBooking}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <CalendarPlus className="w-4 h-4" /> Crear Reserva Manual
          </button>

          <button
            onClick={onOpenCreateTeacher}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo Profesor
          </button>

          <button
            onClick={onOpenCreateBlock}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors"
          >
            <Ban className="w-4 h-4 text-rose-600" /> Bloquear Horario
          </button>
        </div>
      </div>

      {/* STATS METRIC GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Clases Hoy</span>
            <Calendar className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.today_classes || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Programadas para el día de hoy</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Próximas Clases</span>
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.upcoming_classes || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">En las próximas semanas</span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Alumnos</span>
            <Users className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.registered_students || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Usuarios registrados</span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Profesores</span>
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.active_teachers || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Profesores en plantilla activa</span>
        </div>

        {/* Metric 5 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Huecos Libres Hoy</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.available_slots_today || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Plazas aún no reservadas</span>
        </div>

        {/* Metric 6 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Histórico</span>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.total_bookings || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Reservas procesadas</span>
        </div>

        {/* Metric 7 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cancelaciones</span>
            <Ban className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : stats?.cancelled_classes || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Clases anuladas</span>
        </div>
      </div>

      {/* TODAY'S TIMETABLE */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Clases del Día de Hoy</h3>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <button
            onClick={() => onNavigate('bookings')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Ver todas las reservas <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {todayBookings.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            No hay clases programadas para el día de hoy.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayBookings.map(b => (
              <div key={b.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center font-bold text-xs shrink-0">
                    <span className="text-[10px] text-slate-500">HORA</span>
                    <span className="text-xs text-indigo-700 font-extrabold">{b.start_time}</span>
                  </div>

                  <div>
                    <h5 className="font-bold text-sm text-slate-900">
                      Alumno: {b.student_name}
                    </h5>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Profesor: <strong className="text-slate-700">{b.teacher_name}</strong> • Duración:{' '}
                      {b.duration_minutes} min
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${b.status === 'Confirmada'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : b.status === 'Reservada'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
