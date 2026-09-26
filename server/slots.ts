import { db } from './db.ts';
import type { TimeSlot, AppSettings } from '../src/types.ts';
import crypto from 'node:crypto';

// Time calculation helpers
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getDayOfWeekFromDate(dateStr: string): number {
  // dateStr is 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
}

// Fetch current application settings
export async function getAppSettings(): Promise<AppSettings> {
  const row = (await db.prepare('SELECT * FROM settings LIMIT 1').get()) as any;
  if (!row) {
    return {
      id: 'default',
      school_name: 'AutoescuelaPro',
      class_duration_minutes: 45,
      rest_time_minutes: 0,
      min_cancellation_hours: 24,
      reminder_enabled: true,
      reminder_hours_before: 24,
      reminder_title_template: 'Recordatorio: Clase práctica - {fecha} a las {hora}',
      reminder_message_template: 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!',
      reminder_channel: 'both',
      reminder_include_location: true,
      reminder_location_text: 'Sede Central Autoescuela (Av. de la Constitución, 12)',
      timezone: 'Europe/Madrid',
    };
  }
  return {
    id: row.id,
    school_name: row.school_name || 'AutoescuelaPro',
    class_duration_minutes: Number(row.class_duration_minutes),
    rest_time_minutes: Number(row.rest_time_minutes),
    min_cancellation_hours: Number(row.min_cancellation_hours),
    reminder_enabled: Boolean(row.reminder_enabled),
    reminder_hours_before: Number(row.reminder_hours_before ?? 24),
    reminder_title_template: row.reminder_title_template || 'Recordatorio: Clase práctica - {fecha} a las {hora}',
    reminder_message_template: row.reminder_message_template || 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!',
    reminder_channel: (row.reminder_channel as any) || 'both',
    reminder_include_location: row.reminder_include_location === undefined ? true : Boolean(row.reminder_include_location),
    reminder_location_text: row.reminder_location_text || 'Sede Central Autoescuela (Av. de la Constitución, 12)',
    timezone: row.timezone || 'Europe/Madrid',
  };
}

interface GenerateSlotsParams {
  teacherId?: string;
  date: string; // 'YYYY-MM-DD'
  studentId?: string; // If provided, checks if student has conflict
}

export async function generateSlotsForDate(params: GenerateSlotsParams): Promise<TimeSlot[]> {
  const { teacherId, date, studentId } = params;
  const settings = await getAppSettings();
  const duration = settings.class_duration_minutes;
  const rest = settings.rest_time_minutes;
  const dayOfWeek = getDayOfWeekFromDate(date);

  // 1. Get active teachers to inspect
  let teacherQuery = 'SELECT id, name, last_name FROM teachers WHERE is_active = 1';
  const teacherArgs: any[] = [];
  if (teacherId) {
    teacherQuery += ' AND id = ?';
    teacherArgs.push(teacherId);
  }
  teacherQuery += ' ORDER BY name ASC';
  const activeTeachers = (await db.prepare(teacherQuery).all(...teacherArgs)) as { id: string; name: string; last_name: string }[];

  if (activeTeachers.length === 0) {
    return [];
  }

  // 2. Fetch blocks for this date
  const blocks = (await db.prepare(`
    SELECT teacher_id, is_full_day, start_time, end_time, reason
    FROM schedule_blocks
    WHERE date = ?
  `).all(date)) as { teacher_id: string | null; is_full_day: number; start_time: string | null; end_time: string | null; reason: string }[];

  // 3. Fetch bookings for this date with status in ('Reservada', 'Completada')
  const bookings = (await db.prepare(`
    SELECT teacher_id, student_id, start_time, end_time
    FROM bookings
    WHERE date = ? AND status IN ('Reservada', 'Completada')
  `).all(date)) as { teacher_id: string; student_id: string; start_time: string; end_time: string }[];

  const allSlots: TimeSlot[] = [];

  for (const teacher of activeTeachers) {
    // Check if teacher has an active schedule covering this date
    const schedules = (await db.prepare(`
      SELECT id FROM schedules
      WHERE teacher_id = ?
        AND is_active = 1
        AND start_date <= ?
        AND (end_date IS NULL OR end_date = '' OR end_date >= ?)
    `).all(teacher.id, date, date)) as { id: string }[];

    if (schedules.length === 0) {
      continue;
    }

    // Full day block for this teacher or all teachers?
    const hasFullDayBlock = blocks.some(b =>
      (b.teacher_id === null || b.teacher_id === teacher.id) && Number(b.is_full_day) === 1
    );

    if (hasFullDayBlock) {
      continue;
    }

    // Check teacher-specific partial blocks
    const teacherBlocks = blocks.filter(b => b.teacher_id === null || b.teacher_id === teacher.id);

    // Get weekly hours for this day of week across active schedules
    for (const sch of schedules) {
      const weeklyHours = (await db.prepare(`
        SELECT start_time, end_time
        FROM schedule_weekly_hours
        WHERE schedule_id = ? AND day_of_week = ?
        ORDER BY start_time ASC
      `).all(sch.id, dayOfWeek)) as { start_time: string; end_time: string }[];

      for (const interval of weeklyHours) {
        const intervalStart = timeToMinutes(interval.start_time);
        const intervalEnd = timeToMinutes(interval.end_time);

        let currentSlotStart = intervalStart;

        while (currentSlotStart + duration <= intervalEnd) {
          const currentSlotEnd = currentSlotStart + duration;
          const slotStartStr = minutesToTime(currentSlotStart);
          const slotEndStr = minutesToTime(currentSlotEnd);

          // Check if slot overlaps any block
          let isBlocked = false;
          let blockReason = '';

          for (const b of teacherBlocks) {
            if (Number(b.is_full_day) === 1) {
              isBlocked = true;
              blockReason = b.reason || 'Día no laborable';
              break;
            }
            if (b.start_time && b.end_time) {
              const bStart = timeToMinutes(b.start_time);
              const bEnd = timeToMinutes(b.end_time);
              if (currentSlotStart < bEnd && currentSlotEnd > bStart) {
                isBlocked = true;
                blockReason = b.reason || 'Horario bloqueado por administración';
                break;
              }
            }
          }

          // Check if slot overlaps any booking for this teacher
          const isTeacherBooked = bookings.some(bk => {
            if (bk.teacher_id !== teacher.id) return false;
            const bkStart = timeToMinutes(bk.start_time);
            const bkEnd = timeToMinutes(bk.end_time);
            return currentSlotStart < bkEnd && currentSlotEnd > bkStart;
          });

          // Check if the current student already has a class at this time with another teacher
          let isStudentConflict = false;
          if (studentId) {
            isStudentConflict = bookings.some(bk => {
              if (bk.student_id !== studentId) return false;
              const bkStart = timeToMinutes(bk.start_time);
              const bkEnd = timeToMinutes(bk.end_time);
              return currentSlotStart < bkEnd && currentSlotEnd > bkStart;
            });
          }

          let isAvailable = true;
          let reasonUnavailable: string | undefined = undefined;

          if (isBlocked) {
            isAvailable = false;
            reasonUnavailable = `Bloqueado: ${blockReason}`;
          } else if (isTeacherBooked) {
            isAvailable = false;
            reasonUnavailable = 'Profesor ocupado';
          } else if (isStudentConflict) {
            isAvailable = false;
            reasonUnavailable = 'Ya tienes otra clase reservada en este horario';
          }

          allSlots.push({
            teacher_id: teacher.id,
            teacher_name: `${teacher.name} ${teacher.last_name}`,
            date,
            start_time: slotStartStr,
            end_time: slotEndStr,
            duration_minutes: duration,
            is_available: isAvailable,
            reason_unavailable: reasonUnavailable,
          });

          // Move to next slot with configured rest time
          currentSlotStart = currentSlotEnd + rest;
        }
      }
    }
  }

  // Sort slots chronologically and by teacher
  allSlots.sort((a, b) => {
    if (a.start_time !== b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return a.teacher_name.localeCompare(b.teacher_name);
  });

  return allSlots;
}

// Atomic Reservation Creation
export interface CreateBookingParams {
  studentId: string;
  teacherId: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  notes?: string;
  creatorUser?: { id: string; name: string; email: string; role: string };
}

export async function createBookingAtomic(params: CreateBookingParams) {
  const { studentId, teacherId, date, startTime, notes, creatorUser } = params;
  const settings = await getAppSettings();
  const duration = settings.class_duration_minutes;
  const slotStartMinutes = timeToMinutes(startTime);
  const slotEndMinutes = slotStartMinutes + duration;
  const endTime = minutesToTime(slotEndMinutes);
  const now = new Date().toISOString();

  // PostgreSQL transaction to guarantee ACID isolation and prevent double booking
  await db.exec('BEGIN;');

  try {
    // 1. Verify student exists
    const student = (await db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(studentId)) as any;
    if (!student) {
      throw new Error('El alumno especificado no existe.');
    }

    // 2. Verify teacher exists and is active
    const teacher = (await db.prepare('SELECT id, name, last_name, is_active FROM teachers WHERE id = ?').get(teacherId)) as any;
    if (!teacher) {
      throw new Error('El profesor especificado no existe.');
    }
    if (!Number(teacher.is_active)) {
      throw new Error('El profesor no se encuentra activo para recibir nuevas reservas.');
    }

    // 3. Verify schedule covers date
    const schedule = (await db.prepare(`
      SELECT id FROM schedules
      WHERE teacher_id = ?
        AND is_active = 1
        AND start_date <= ?
        AND (end_date IS NULL OR end_date = '' OR end_date >= ?)
      LIMIT 1
    `).get(teacherId, date, date)) as { id: string } | undefined;

    if (!schedule) {
      throw new Error('El profesor no tiene una agenda activa para la fecha seleccionada.');
    }

    // 4. Verify weekly hours interval exists covering this slot
    const dayOfWeek = getDayOfWeekFromDate(date);
    const weeklyHours = (await db.prepare(`
      SELECT start_time, end_time
      FROM schedule_weekly_hours
      WHERE schedule_id = ? AND day_of_week = ?
    `).all(schedule.id, dayOfWeek)) as { start_time: string; end_time: string }[];

    const fitsInterval = weeklyHours.some(wh => {
      const whStart = timeToMinutes(wh.start_time);
      const whEnd = timeToMinutes(wh.end_time);
      return slotStartMinutes >= whStart && slotEndMinutes <= whEnd;
    });

    if (!fitsInterval) {
      throw new Error('El horario seleccionado se encuentra fuera de la jornada del profesor.');
    }

    // 5. Verify no blocks for date/time
    const blocks = (await db.prepare(`
      SELECT is_full_day, start_time, end_time, reason
      FROM schedule_blocks
      WHERE date = ? AND (teacher_id IS NULL OR teacher_id = ?)
    `).all(date, teacherId)) as any[];

    for (const b of blocks) {
      if (Number(b.is_full_day) === 1) {
        throw new Error(`La fecha está bloqueada: ${b.reason || 'Día no disponible'}`);
      }
      if (b.start_time && b.end_time) {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        if (slotStartMinutes < bEnd && slotEndMinutes > bStart) {
          throw new Error(`El horario está bloqueado: ${b.reason || 'Horario no disponible'}`);
        }
      }
    }

    // 6. CRITICAL: Atomic check for overlapping bookings on Teacher
    const teacherConflict = await db.prepare(`
      SELECT id FROM bookings
      WHERE teacher_id = ?
        AND date = ?
         AND status IN ('Reservada', 'Completada')
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `).get(teacherId, date, startTime, endTime);

    if (teacherConflict) {
      throw new Error('Este horario ya ha sido reservado por otro alumno. Por favor selecciona otro.');
    }

    // 7. CRITICAL: Atomic check for overlapping bookings on Student
    const studentConflict = await db.prepare(`
      SELECT id, start_time, end_time FROM bookings
      WHERE student_id = ?
        AND date = ?
        AND status IN ('Reservada', 'Completada')
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `).get(studentId, date, startTime, endTime);

    if (studentConflict) {
      throw new Error('Ya tienes otra clase reservada en este mismo horario.');
    }

    // 8. Insert booking
    const bookingId = 'bk_' + crypto.randomUUID().slice(0, 8);
    await db.prepare(`
      INSERT INTO bookings (
        id, student_id, teacher_id, schedule_id, date, start_time, end_time, duration_minutes, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingId,
      studentId,
      teacherId,
      schedule.id,
      date,
      startTime,
      endTime,
      duration,
      'Reservada',
      notes || '',
      now,
      now
    );

    // 9. Add Audit Log
    const auditUser = creatorUser || { id: studentId, name: student.name, email: student.email };
    const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const displayDate = dateMatch ? `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}` : date;

    await db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      auditUser.id,
      auditUser.name,
      auditUser.email,
      'Creación de reserva',
      'booking',
      bookingId,
      `Reserva creada para alumno ${student.name} con profesor ${teacher.name} ${teacher.last_name} el día ${displayDate} de ${startTime} a ${endTime} (${duration} min).`,
      now
    );

    // 10. Notification for Student
    await db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      studentId,
      'booking_created',
      'Reserva registrada',
      `Tu clase con ${teacher.name} ${teacher.last_name} para el ${displayDate} a las ${startTime} ha sido registrada con éxito.`,
      0,
      now
    );

    await db.exec('COMMIT;');

    return {
      id: bookingId,
      student_id: studentId,
      student_name: student.name,
      teacher_id: teacherId,
      teacher_name: `${teacher.name} ${teacher.last_name}`,
      date,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: duration,
      status: 'Reservada',
      notes,
    };
  } catch (err) {
    try {
      await db.exec('ROLLBACK;');
    } catch { }
    throw err;
  }
}
