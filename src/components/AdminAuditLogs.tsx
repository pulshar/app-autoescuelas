import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { replaceDateInText } from '../lib/dateUtils.ts';
import type { AuditLog } from '../types.ts';
import { CheckCheck, Clock, User, ShieldCheck, Search } from 'lucide-react';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs();
      setLogs(res.logs);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.user_name && l.user_name.toLowerCase().includes(q)) ||
      (l.details && l.details.toLowerCase().includes(q)) ||
      (l.entity_type && l.entity_type.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Registro de Auditoría y Actividad
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Trazabilidad completa de operaciones administrativas, reservas, bloqueos y modificaciones.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en el registro..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
            Cargando registros de auditoría...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No hay registros de auditoría registrados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {log.action}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      por {log.user_name}
                    </span>
                    <span className="text-[10px] text-slate-400">({log.user_email})</span>
                  </div>

                  <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(log.created_at).toLocaleString('es-ES')}
                  </span>
                </div>

                <p className="text-xs text-slate-600 pl-1 leading-relaxed">
                  {replaceDateInText(log.details) || 'Acción ejecutada correctamente'}
                </p>

                <div className="mt-1.5 pl-1 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                  <span>Entidad: {log.entity_type}</span>
                  <span>ID: {log.entity_id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
