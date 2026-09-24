import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
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
  CheckCircle2,
  CalendarPlus,
  LogIn,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

function AppContent() {
  const { user, role, login } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [initialAuthEmail, setInitialAuthEmail] = useState('');

  // Admin Modals
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [initialOpenCreateTeacher, setInitialOpenCreateTeacher] = useState(false);
  const [initialOpenCreateBlock, setInitialOpenCreateBlock] = useState(false);


  // Check for ?login=true & ?email= in URL from welcome email link
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'true' || params.get('login') === '1') {
        const emailParam = params.get('email') || '';
        if (emailParam) {
          setInitialAuthEmail(emailParam);
        }
        setAuthModalMode('login');
        setAuthModalOpen(true);
        // Clear params cleanly without reload
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-16 md:pb-6">
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
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-8 sm:p-12 shadow-2xl">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> Autoescuela Online 24/7
                </span>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  Reserva tus clases de conducir <span className="text-indigo-400">online</span> en segundos.
                </h1>

                <p className="text-sm sm:text-base text-indigo-100/90 mt-4 leading-relaxed">
                  Elige a tu profesor de prácticas, consulta los horarios disponibles en tiempo real,
                  reserva desde tu móvil y recibe confirmación instantánea sin llamadas ni esperas.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 mt-8">
                  <button
                    onClick={() => handleOpenAuth('register')}
                    className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                  >
                    <span>Empezar ahora</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenAuth('login')}
                    className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm sm:text-base border border-white/20 backdrop-blur-xs transition-colors"
                  >
                    Iniciar sesión
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Demo Switcher (Instant Evaluation for Test Users) */}
            {/* <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <div className="text-center max-w-lg mx-auto mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Acceso Inmediato
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                  Prueba la aplicación con un solo clic
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Accede como alumno para reservar clases o como administrador para gestionar profesores y horarios.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                <button
                  onClick={() => login('alvaroq@gmail.com', 'alumno05')}
                  className="p-5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                      <UserCheck className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold text-indigo-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Entrar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900">Acceso Alumno</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Álvaro Quevedo (alvaroq@gmail.com)
                  </p>
                  <span className="inline-block text-[11px] text-indigo-700 font-medium mt-2 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                    Reserva online de clases prácticas
                  </span>
                </button>

                <button
                  onClick={() => login('alvaroq.dev@gmail.com', 'admin05')}
                  className="p-5 rounded-2xl border-2 border-amber-200 hover:border-amber-600 bg-amber-50/40 hover:bg-amber-50 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Entrar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900">Acceso Administrador</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Dirección (alvaroq.dev@gmail.com)
                  </p>
                  <span className="inline-block text-[11px] text-amber-700 font-medium mt-2 bg-white px-2 py-0.5 rounded-md border border-amber-100">
                    Gestión total de profesores y turnos
                  </span>
                </button>
              </div>
            </div> */}

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-base text-slate-900">Horarios en Tiempo Real</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Algoritmo inteligente de turnos que previene solapamientos y reservas dobles de forma atómica.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4">
                  <Car className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-base text-slate-900">Profesores Titulares</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Elige al profesor con el que tengas mayor afinidad o consulta los turnos de cualquier instructor libre.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-base text-slate-900">Cancelaciones Claras</h4>
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
                onOpenManualBooking={() => setManualBookingOpen(true)}
                onOpenCreateTeacher={() => {
                  setCurrentTab('teachers');
                  setInitialOpenCreateTeacher(true);
                }}
                onOpenCreateBlock={() => {
                  setCurrentTab('blocks');
                  setInitialOpenCreateBlock(true);
                }}
              />
            )}

            {currentTab === 'bookings' && (
              <AdminBookings onOpenManualModal={() => setManualBookingOpen(true)} />
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
                onSelectStudentForBooking={_studentId => {
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
              <div className="py-2">
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
      />

      {/* Manual Booking Modal for Admin */}
      <ManualBookingModal
        isOpen={manualBookingOpen}
        onClose={() => setManualBookingOpen(false)}
        onSuccess={() => {
          setCurrentTab('bookings');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
