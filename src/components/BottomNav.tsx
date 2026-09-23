import { useAuth } from '../context/AuthContext.tsx';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  User,
  Calendar,
  Users,
  Settings,
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export default function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const { user, role } = useAuth();

  if (!user) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg">
      <div className="flex items-center justify-around">
        {role === 'admin' ? (
          <>
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onSelectTab('bookings')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'bookings' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <CalendarCheck className="w-5 h-5 mb-0.5" />
              <span>Reservas</span>
            </button>

            <button
              onClick={() => onSelectTab('calendar')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'calendar' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>Calendario</span>
            </button>

            <button
              onClick={() => onSelectTab('teachers')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'teachers' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Profesores</span>
            </button>

            <button
              onClick={() => onSelectTab('settings')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                ['settings', 'schedules', 'blocks', 'students', 'audit'].includes(currentTab)
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-500'
              }`}
            >
              <Settings className="w-5 h-5 mb-0.5" />
              <span>Ajustes</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              <span>Inicio</span>
            </button>

            <button
              onClick={() => onSelectTab('book')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'book' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <CalendarPlus className="w-5 h-5 mb-0.5" />
              <span>Reservar</span>
            </button>

            <button
              onClick={() => onSelectTab('my-classes')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'my-classes' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <CalendarCheck className="w-5 h-5 mb-0.5" />
              <span>Mis Clases</span>
            </button>

            <button
              onClick={() => onSelectTab('profile')}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                currentTab === 'profile' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <User className="w-5 h-5 mb-0.5" />
              <span>Perfil</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
