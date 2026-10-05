import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast, type Toast } from '../context/ToastContext';

/* ──────────────────────────────────────────────────────────────────────────
   Colour tokens per type
────────────────────────────────────────────────────────────────────────── */
const STYLES: Record<
  Toast['type'],
  { bg: string; text: string; Icon: React.FC<{ className?: string }> }
> = {
  success: {
    bg: 'bg-white',
    text: 'text-slate-800',
    Icon: ({ className }) => <CheckCircle2 className={className} />,
  },
  error: {
    bg: 'bg-white',
    text: 'text-slate-800',
    Icon: ({ className }) => <XCircle className={className} />,
  },
  info: {
    bg: 'bg-white',
    text: 'text-slate-800',
    Icon: ({ className }) => <Info className={className} />,
  },
  warning: {
    bg: 'bg-white',
    text: 'text-slate-800',
    Icon: ({ className }) => <AlertTriangle className={className} />,
  },
};

const ICON_COLORS: Record<Toast['type'], string> = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
};

/* ──────────────────────────────────────────────────────────────────────────
   Single toast item
────────────────────────────────────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const duration = toast.duration ?? 8000;
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { bg, text, Icon } = STYLES[toast.type];
  const iconColor = ICON_COLORS[toast.type];

  // Slide-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);


  // Auto-dismiss after duration
  useEffect(() => {
    timerRef.current = setTimeout(() => handleDismiss(), duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [duration]);


  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease',
        willChange: 'transform, opacity',
      }}
      className={`relative w-full max-w-sm rounded-lg shadow-lg shadow-black/10 ring-1 ring-black/5 overflow-hidden flex flex-col ${bg}`}
      role="alert"
      aria-live="polite"
    >
      {/* Content row */}
      <div className="flex items-start gap-3 p-5">
        <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
        <p className={`flex-1 text-sm leading-snug ${text}`}>{toast.message}</p>
        <button
          onClick={handleDismiss}
          className="shrink-0 mt-0.5 text-slate-400 hover:text-slate-600 transition-colors rounded-md p-0.5 -mr-1"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Toast container (portal, top-right)
────────────────────────────────────────────────────────────────────────── */
export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return createPortal(
    <div
      aria-label="Notificaciones"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none"
      style={{ maxWidth: '24rem', width: 'calc(100vw - 2rem)' }}
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto w-full">
          <ToastItem toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>,
    document.body
  );
}
