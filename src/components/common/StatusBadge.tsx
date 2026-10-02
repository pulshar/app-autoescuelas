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
    if (statusStr.startsWith('Cancelada')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }

    switch (statusStr) {
      case 'Reservada':
        return 'bg-blue-50 text-blue-700 border-blue-200';

      case 'Pendiente de revisión':
        return 'bg-amber-50 text-amber-700 border-amber-200';

      case 'Completada':
        return 'bg-slate-100 text-slate-700 border-slate-300';

      case 'No presentado':
        return 'bg-rose-50 text-rose-700 border-rose-200';

      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
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
