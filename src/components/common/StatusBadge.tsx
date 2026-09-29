import React from 'react';
import type { BookingStatus } from '../../types.ts';

interface StatusBadgeProps {
  status: BookingStatus | string;
  className?: string;
  'data-testid'?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  'data-testid': testId,
}) => {
  const getBadgeStyle = (statusStr: string) => {
    switch (statusStr) {
      case 'Reservada':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pendiente de revisión':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Completada':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'No presentado':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Cancelada por alumno':
      case 'Cancelada por administrador':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      data-testid={testId || `status-badge-${status.toLowerCase().replace(/\s+/g, '-')}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(
        status
      )} ${className}`}
    >
      {status}
    </span>
  );
};
