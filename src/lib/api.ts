import type {
  User,
  Teacher,
  Schedule,
  ScheduleBlock,
  Booking,
  AppSettings,
  AuditLog,
  NotificationItem,
  ReminderLogItem,
  ResendStatus,
  TimeSlot,
  DashboardStats,
} from '../types.ts';

const TOKEN_KEY = 'autoescuela_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Error en la petición al servidor.');
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: { email: string; password: string; name: string; phone?: string }) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  googleLogin: (body: { email: string; name: string; googleId?: string; avatarUrl?: string }) =>
    request<{ user: User; token: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getMe: () => request<{ user: User }>('/api/auth/me'),

  updateProfile: (body: { name: string; phone?: string; avatar_url?: string }) =>
    request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string; resetToken?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (body: { token: string; newPassword: string }) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Teachers
  getTeachers: () => request<{ teachers: Teacher[] }>('/api/teachers'),
  createTeacher: (body: Partial<Teacher>) =>
    request<{ teacher: Teacher }>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTeacher: (id: string, body: Partial<Teacher>) =>
    request<{ teacher: Teacher }>(`/api/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteTeacher: (id: string) =>
    request<{ message: string }>(`/api/teachers/${id}`, {
      method: 'DELETE',
    }),

  // Schedules
  getSchedules: (teacherId?: string) =>
    request<{ schedules: Schedule[] }>(
      teacherId ? `/api/schedules?teacher_id=${encodeURIComponent(teacherId)}` : '/api/schedules'
    ),
  createSchedule: (body: any) =>
    request<{ id: string; message: string }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSchedule: (id: string, body: any) =>
    request<{ message: string }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteSchedule: (id: string) =>
    request<{ message: string }>(`/api/schedules/${id}`, {
      method: 'DELETE',
    }),

  // Blocks
  getBlocks: (date?: string, teacherId?: string) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (teacherId) params.set('teacher_id', teacherId);
    return request<{ blocks: ScheduleBlock[] }>(`/api/blocks?${params.toString()}`);
  },
  createBlock: (body: any) =>
    request<{ id: string; message: string }>('/api/blocks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteBlock: (id: string) =>
    request<{ message: string }>(`/api/blocks/${id}`, {
      method: 'DELETE',
    }),

  // Slots
  getSlots: (date: string, teacherId?: string) => {
    const params = new URLSearchParams({ date });
    if (teacherId) params.set('teacher_id', teacherId);
    return request<{ date: string; slots: TimeSlot[] }>(`/api/slots?${params.toString()}`);
  },

  getCalendarAvailability: (year: number, month: number, teacherId?: string) => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (teacherId) params.set('teacher_id', teacherId);
    return request<{ year: number; month: number; availability: Record<string, { total: number; available: number }> }>(
      `/api/calendar-availability?${params.toString()}`
    );
  },

  // Bookings
  getBookings: (filters: { student_id?: string; teacher_id?: string; status?: string; date?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.student_id) params.set('student_id', filters.student_id);
    if (filters.teacher_id) params.set('teacher_id', filters.teacher_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.date) params.set('date', filters.date);
    return request<{ bookings: Booking[] }>(`/api/bookings?${params.toString()}`);
  },

  createBooking: (body: { teacher_id: string; date: string; start_time: string; notes?: string; student_id?: string }) =>
    request<{ booking: Booking; message: string }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancelBooking: (id: string, reason?: string) =>
    request<{ message: string }>(`/api/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  updateBookingStatus: (id: string, status: string, notes?: string) =>
    request<{ message: string }>(`/api/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    }),

  // Settings
  getSettings: () => request<{ settings: AppSettings }>('/api/settings'),
  updateSettings: (body: Partial<AppSettings>) =>
    request<{ settings: AppSettings; message: string }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Stats & Admin
  getStats: () => request<{ stats: DashboardStats }>('/api/stats'),
  getStudents: () => request<{ students: (User & { total_bookings: number; completed_classes: number; active_classes: number })[] }>('/api/students'),
  getAuditLogs: () => request<{ logs: AuditLog[] }>('/api/audit-logs'),

  // Notifications
  getNotifications: () => request<{ notifications: NotificationItem[] }>('/api/notifications'),
  markNotificationRead: (id: string) =>
    request<{ message: string }>(`/api/notifications/${id}/read`, {
      method: 'PUT',
    }),
  testReminderNotification: (body?: {
    title_template?: string;
    message_template?: string;
    location_text?: string;
    include_location?: boolean;
  }) =>
    request<{ message: string; preview: { title: string; message: string } }>(
      '/api/notifications/test-reminder',
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    ),
  processAutomaticReminders: () =>
    request<{ sent: number; checked: number; message: string }>(
      '/api/notifications/process-reminders',
      {
        method: 'POST',
      }
    ),
  getRemindersLog: () =>
    request<{ reminders: ReminderLogItem[] }>('/api/notifications/reminders-log'),
  getResendStatus: () =>
    request<ResendStatus>('/api/notifications/resend-status'),
  sendTestEmail: (to?: string) =>
    request<{ success: boolean; configured: boolean; message: string; recipient: string; id?: string }>(
      '/api/notifications/test-email',
      {
        method: 'POST',
        body: JSON.stringify({ to }),
      }
    ),
};
