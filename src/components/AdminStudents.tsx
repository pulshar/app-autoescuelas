import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import type { User } from '../types.ts';
import {
  Users,
  Search,
  Phone,
  Mail,
  Calendar,
  CalendarPlus,
  Car,
} from 'lucide-react';

interface AdminStudentsProps {
  onSelectStudentForBooking: (studentId: string) => void;
}

export default function AdminStudents({ onSelectStudentForBooking }: AdminStudentsProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.getStudents();
      setStudents(res.students);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Alumnos Registrados</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Directorio de alumnos con métricas de clases prácticas cursadas y programadas.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar alumno por nombre o email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
            Cargando alumnos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No se encontraron alumnos registrados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(s => (
              <div
                key={s.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base shrink-0">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">{s.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {s.email}
                      </span>
                      {s.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {s.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-6 sm:self-center">
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Activas
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-indigo-700">
                      {s.active_classes || 0}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Completadas
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-700">
                      {s.completed_classes || 0}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Total Clases
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      {s.total_bookings || 0}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectStudentForBooking(s.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" /> Asignar Clase
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
