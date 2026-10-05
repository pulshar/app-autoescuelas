import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import ToastContainer from './components/ToastContainer.tsx';
import Navbar from './components/Navbar.tsx';
import BottomNav from './components/BottomNav.tsx';
import AuthModal from './components/AuthModal.tsx';
import StudentDashboard from './components/StudentDashboard.tsx';
import BookingWizard from './components/BookingWizard.tsx';
import MyClasses from './components/MyClasses.tsx';
import CalendarView from './components/CalendarView.tsx';
import ProfileView from './components/ProfileView.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import AdminBookings from './components/AdminBookings.tsx';
import AdminTeachers from './components/AdminTeachers.tsx';
import AdminSchedules from './components/AdminSchedules.tsx';
import AdminBlocks from './components/AdminBlocks.tsx';
import AdminSettings from './components/AdminSettings.tsx';
import AdminStudents from './components/AdminStudents.tsx';
import AdminAuditLogs from './components/AdminAuditLogs.tsx';
import ManualBookingModal from './components/ManualBookingModal.tsx';
import {
  Car,
  CalendarCheck,
  Clock,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

function AppContent() {
  const { user, role, login, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [initialAuthEmail, setInitialAuthEmail] = useState('');
  const [initialResetToken, setInitialResetToken] = useState('');

  // Admin Modals
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [manualBookingInitialStudentId, setManualBookingInitialStudentId] = useState<string | undefined>(undefined);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [initialOpenCreateTeacher, setInitialOpenCreateTeacher] = useState(false);
  const [initialOpenCreateBlock, setInitialOpenCreateBlock] = useState(false);


  // Check for URL parameters (?login=true, ?email=..., ?resetToken=...)
  useEffect(() => {

    // Esperamos a que AuthContext termine de comprobar la sesión
    if (loading) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const resetTokenParam = params.get('resetToken') || params.get('token');
      const emailParam = params.get('email') || '';

      // Recuperación de contraseña
      if (resetTokenParam) {
        if (emailParam) {
          setInitialAuthEmail(emailParam);
        }

        setInitialResetToken(resetTokenParam);
        setAuthModalMode('reset');
        setAuthModalOpen(true);

        // Clear params cleanly without reload
        window.history.replaceState({}, document.title, window.location.pathname);

        return;
      }

      // Login desde enlace de email
      if (params.get('login') === 'true' || params.get('login') === '1') {
        if (emailParam) {
          setInitialAuthEmail(emailParam);
        }

        // Solo mostramos login si NO hay sesión
        if (!user) {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }

        // Limpiar los parámetros de la URL
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } catch {
      // Ignore
    }
  }, [loading, user]);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-brand-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-brand-500 selection:text-white pb-16 md:pb-6">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={() => handleOpenAuth('login')}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {!user ? (
          /* Unauthenticated Landing & Quick Access */
          <div className="space-y-12 py-6">
            {/* Hero Card */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-900 via-slate-900 to-brand-950 text-white p-8 sm:p-12 shadow-xs">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/25 text-brand-300 border border-brand-400/30 mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> Autoescuela Online 24/7
                </span>

                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                  Reserva tus clases de conducir <span className="text-brand-400">online</span> en segundos.
                </h1>

                <p className="text-sm sm:text-base text-brand-100/90 mt-4 leading-relaxed">
                  Elige a tu profesor de prácticas, consulta los horarios disponibles en tiempo real,
                  reserva desde tu móvil y recibe confirmación instantánea sin llamadas ni esperas.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 mt-8">
                  <button
                    onClick={() => handleOpenAuth('register')}
                    className="btn-w-100 px-6 py-3.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm sm:text-base transition-all flex items-center gap-2"
                  >
                    <span>Empezar ahora</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenAuth('login')}
                    className="btn-w-100 px-6 py-3.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-sm sm:text-base border border-white/20 backdrop-blur-xs transition-colors"
                  >
                    Iniciar sesión
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Demo Switcher (Instant Evaluation for Test Users) */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <div className="text-center max-w-lg mx-auto mb-6">
                <span className="text-xs font-mono text-brand-600">
                  Acceso Inmediato
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  Prueba la aplicación con un solo clic
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Accede como alumno para reservar clases o como administrador para gestionar profesores y horarios.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                <button
                  onClick={() => login('alvaroq@gmail.com', 'alumno05')}
                  className="p-5 rounded-lg border-2 border-brand-200 hover:border-brand-600 bg-brand-50/40 hover:bg-brand-50 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">
                      <UserCheck className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold text-brand-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Entrar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-slate-900">Acceso Alumno</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Álvaro Quevedo (alvaroq@gmail.com)
                  </p>
                  <span className="inline-block text-[11px] text-brand-700 font-medium mt-2 bg-white px-2 py-0.5 rounded-md border border-brand-100">
                    Reserva online de clases prácticas
                  </span>
                </button>

                <button
                  onClick={() => login('alvaroq.dev@gmail.com', 'admin05')}
                  className="p-5 rounded-lg border-2 border-amber-200 hover:border-amber-600 bg-amber-50/40 hover:bg-amber-50 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Entrar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-slate-900">Acceso Administrador</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Dirección (alvaroq.dev@gmail.com)
                  </p>
                  <span className="inline-block text-[11px] text-amber-700 font-medium mt-2 bg-white px-2 py-0.5 rounded-md border border-amber-100">
                    Gestión total de profesores y turnos
                  </span>
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-slate-900">Horarios en tiempo real</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Algoritmo inteligente de turnos que previene solapamientos y reservas dobles de forma atómica.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
                  <Car className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-slate-900">Profesores titulares</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Elige al profesor con el que tengas mayor afinidad o consulta los turnos de cualquier instructor libre.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-slate-900">Cancelaciones claras</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Política de cancelación con plazo de 24 horas y liberación instantánea de huecos para otros alumnos.
                </p>
              </div>
            </div>
          </div>
        ) : role === 'admin' ? (
          /* ======================================================== */
          /* ADMIN PORTAL */
          /* ======================================================== */
          <div>
            {currentTab === 'dashboard' && (
              <AdminDashboard
                onNavigate={setCurrentTab}
                onOpenManualBooking={() => {
                  setManualBookingInitialStudentId(undefined);
                  setManualBookingOpen(true);
                }}
                onOpenCreateTeacher={() => {
                  setCurrentTab('teachers');
                  setInitialOpenCreateTeacher(true);
                }}
                onOpenCreateBlock={() => {
                  setCurrentTab('blocks');
                  setInitialOpenCreateBlock(true);
                }}
                refreshTrigger={bookingsRefreshKey}
              />
            )}

            {currentTab === 'bookings' && (
              <AdminBookings
                onOpenManualModal={() => {
                  setManualBookingInitialStudentId(undefined);
                  setManualBookingOpen(true);
                }}
                refreshTrigger={bookingsRefreshKey}
              />
            )}

            {currentTab === 'calendar' && <CalendarView />}

            {currentTab === 'teachers' && (
              <AdminTeachers
                initialOpenCreate={initialOpenCreateTeacher}
                onResetInitialOpenCreate={() => setInitialOpenCreateTeacher(false)}
              />
            )}

            {currentTab === 'schedules' && <AdminSchedules />}

            {currentTab === 'blocks' && (
              <AdminBlocks
                initialOpenCreate={initialOpenCreateBlock}
                onResetInitialOpenCreate={() => setInitialOpenCreateBlock(false)}
              />
            )}

            {currentTab === 'students' && (
              <AdminStudents
                onSelectStudentForBooking={studentId => {
                  setManualBookingInitialStudentId(studentId);
                  setManualBookingOpen(true);
                }}
              />
            )}

            {currentTab === 'settings' && <AdminSettings />}

            {currentTab === 'audit' && <AdminAuditLogs />}

            {currentTab === 'profile' && <ProfileView />}
          </div>
        ) : (
          /* ======================================================== */
          /* STUDENT PORTAL */
          /* ======================================================== */
          <div>
            {currentTab === 'dashboard' && (
              <StudentDashboard onNavigate={setCurrentTab} />
            )}

            {currentTab === 'book' && (
              <div className="py-2 pb-12">
                <BookingWizard
                  onSuccess={() => {
                    setCurrentTab('my-classes');
                  }}
                  onCancel={() => setCurrentTab('dashboard')}
                />
              </div>
            )}

            {currentTab === 'my-classes' && (
              <MyClasses onNavigateToBook={() => setCurrentTab('book')} />
            )}

            {currentTab === 'calendar' && (
              <CalendarView onNavigateToBook={() => setCurrentTab('book')} />
            )}

            {currentTab === 'profile' && <ProfileView />}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        initialEmail={initialAuthEmail}
        initialResetToken={initialResetToken}
      />

      {/* Manual Booking Modal for Admin */}
      <ManualBookingModal
        isOpen={manualBookingOpen}
        onClose={() => setManualBookingOpen(false)}
        onSuccess={() => {
          setBookingsRefreshKey(prev => prev + 1);
          setCurrentTab('bookings');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <ToastContainer />
    </ToastProvider>
  );
}
