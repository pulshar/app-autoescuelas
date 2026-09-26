export type UserRole = 'admin' | 'student';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Teacher {
  id: string;
  name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface WeeklyHour {
  id?: string;
  schedule_id?: string;
  day_of_week: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  start_time: string;  // "09:00"
  end_time: string;    // "13:00"
}

export interface Schedule {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  name: string;
  start_date: string; // "YYYY-MM-DD"
  end_date?: string;  // "YYYY-MM-DD" or null/empty
  is_active: boolean;
  timezone: string;
  weekly_hours?: WeeklyHour[];
  created_at: string;
  updated_at?: string;
}

export interface ScheduleBlock {
  id: string;
  teacher_id?: string | null; // null means all teachers
  teacher_name?: string | null;
  date: string; // "YYYY-MM-DD"
  is_full_day: boolean;
  start_time?: string | null; // "10:00"
  end_time?: string | null;   // "12:00"
  reason: string;
  created_at: string;
}

export type BookingStatus =
  | 'Reservada'
  | 'Pendiente de revisión'
  | 'Completada'
  | 'No presentado'
  | 'Cancelada por alumno'
  | 'Cancelada por administrador';

export interface Booking {
  id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  teacher_id: string;
  teacher_name?: string;
  schedule_id?: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "09:00"
  end_time: string;   // "09:45"
  duration_minutes: number;
  status: BookingStatus;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface AppSettings {
  id: string;
  school_name?: string;
  class_duration_minutes: number;
  rest_time_minutes: number;
  min_cancellation_hours: number;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  reminder_title_template?: string;
  reminder_message_template?: string;
  reminder_channel?: 'app' | 'email' | 'both';
  reminder_include_location?: boolean;
  reminder_location_text?: string;
  timezone: string;
}

export interface ReminderLogItem {
  id: string;
  user_id: string;
  student_name?: string;
  student_email?: string;
  booking_id?: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'booking_created' | 'booking_cancelled' | 'booking_status' | 'reminder';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface TimeSlot {
  teacher_id: string;
  teacher_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  is_available: boolean;
  reason_unavailable?: string;
}

export interface DashboardStats {
  today_classes: number;
  pending_reviews?: number;
  upcoming_classes: number;
  total_bookings: number;
  active_teachers: number;
  registered_students: number;
  available_slots_today: number;
  cancelled_classes: number;
}

export interface ResendStatus {
  configured: boolean;
  sender: string;
  isSandbox?: boolean;
  authorizedTestEmail?: string;
}

