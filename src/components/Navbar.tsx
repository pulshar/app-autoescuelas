import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { replaceDateInText } from '../lib/dateUtils.ts';
import type { NotificationItem } from '../types.ts';
import {
  Car,
  Bell,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  CheckCheck,
  X,
  LogIn,
  KeyRound,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
}

export default function Navbar({ currentTab, onSelectTab, onOpenAuth }: NavbarProps) {
  const { user, role, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Handle outside click and Escape key for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        showNotifications &&
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
      if (
        showProfileMenu &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target)
      ) {
        setShowProfileMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications, showProfileMenu]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // Ignore
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onSelectTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                  Autoescuela<span className="text-indigo-600">Pro</span>
                </span>
                {role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : role === 'student' ? (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Alumno
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Gestión y Reserva Online de Clases</p>
            </div>
          </div>

          {/* Desktop Navigation Links (Admin or Student) */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {role === 'admin' ? (
                <>
                  <button
                    onClick={() => onSelectTab('dashboard')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'dashboard'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => onSelectTab('bookings')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'bookings'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Reservas
                  </button>
                  <button
                    onClick={() => onSelectTab('calendar')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'calendar'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Calendario
                  </button>
                  <button
                    onClick={() => onSelectTab('teachers')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'teachers'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Profesores
                  </button>
                  <button
                    onClick={() => onSelectTab('schedules')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'schedules'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Agendas
                  </button>
                  <button
                    onClick={() => onSelectTab('blocks')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'blocks'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Bloqueos
                  </button>
                  <button
                    onClick={() => onSelectTab('students')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'students'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Alumnos
                  </button>
                  <button
                    onClick={() => onSelectTab('settings')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'settings'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Configuración
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onSelectTab('dashboard')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'dashboard'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Inicio
                  </button>
                  <button
                    onClick={() => onSelectTab('book')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'book'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Reservar Clase
                  </button>
                  <button
                    onClick={() => onSelectTab('my-classes')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'my-classes'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Mis Clases
                  </button>
                  <button
                    onClick={() => onSelectTab('calendar')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentTab === 'calendar'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    Calendario
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right Action Menu: Notifications & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                {/* Notifications Bell */}
                <div className="relative" ref={notificationsRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(prev => !prev);
                      setShowProfileMenu(false);
                    }}
                    className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 relative transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    aria-label="Notificaciones"
                    aria-expanded={showNotifications}
                    aria-haspopup="true"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Popover */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                        <h4 className="font-semibold text-slate-900 text-sm">Notificaciones</h4>
                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                          aria-label="Cerrar notificaciones"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No tienes notificaciones
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div
                              key={n.id}
                              onClick={() => handleMarkRead(n.id)}
                              className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-indigo-50/40' : ''
                                }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-xs text-slate-800">{n.title}</span>
                                {!n.read && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{replaceDateInText(n.message)}</p>
                              <span className="text-[10px] text-slate-400 mt-1.5 block">
                                {new Date(n.created_at).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Profile Avatar / Dropdown */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(prev => !prev);
                      setShowNotifications(false);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    aria-label="Menú de usuario"
                    aria-expanded={showProfileMenu}
                    aria-haspopup="true"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline text-xs font-medium text-slate-700 max-w-[120px] truncate">
                      {user.name.split(' ')[0]}
                    </span>
                  </button>

                  {/* Profile Menu */}
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          onSelectTab('profile');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <UserIcon className="w-4 h-4 text-slate-400" /> Mi Perfil
                      </button>
                      {role === 'admin' && (
                        <button
                          onClick={() => {
                            onSelectTab('audit');
                            setShowProfileMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <CheckCheck className="w-4 h-4 text-slate-400" /> Registro de Auditoría
                        </button>
                      )}
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        onClick={() => {
                          logout();
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" /> Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Iniciar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
