import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'autoescuela.db');
export const db = new DatabaseSync(dbPath);

// Enable foreign keys & WAL mode
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch {
  // Ignore in environments where WAL is not allowed
}

// Password hashing utilities using built-in crypto (scrypt)
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const key = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Initialize tables and schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT,
      salt TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'student',
      google_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      photo_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_weekly_hours (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_blocks (
      id TEXT PRIMARY KEY,
      teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      is_full_day INTEGER NOT NULL DEFAULT 1,
      start_time TEXT,
      end_time TEXT,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL REFERENCES teachers(id),
      schedule_id TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Reservada',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      class_duration_minutes INTEGER NOT NULL DEFAULT 45,
      rest_time_minutes INTEGER NOT NULL DEFAULT 0,
      min_cancellation_hours INTEGER NOT NULL DEFAULT 24,
      reminder_enabled INTEGER NOT NULL DEFAULT 1,
      reminder_hours_before INTEGER NOT NULL DEFAULT 24,
      reminder_title_template TEXT DEFAULT 'Recordatorio: Clase práctica - {fecha} a las {hora}',
      reminder_message_template TEXT DEFAULT 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!',
      reminder_channel TEXT DEFAULT 'both',
      reminder_include_location INTEGER DEFAULT 1,
      reminder_location_text TEXT DEFAULT 'Sede Central Autoescuela (Av. de la Constitución, 12)',
      timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_teacher_date ON bookings(teacher_id, date);
    CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);
    CREATE INDEX IF NOT EXISTS idx_blocks_date ON schedule_blocks(date);
    CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON schedules(teacher_id);
  `);

  // Migrations for existing settings table
  try {
    db.exec("ALTER TABLE settings ADD COLUMN reminder_title_template TEXT DEFAULT 'Recordatorio: Clase práctica - {fecha} a las {hora}';");
  } catch {}
  try {
    db.exec("ALTER TABLE settings ADD COLUMN reminder_message_template TEXT DEFAULT 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!';");
  } catch {}
  try {
    db.exec("ALTER TABLE settings ADD COLUMN reminder_channel TEXT DEFAULT 'both';");
  } catch {}
  try {
    db.exec("ALTER TABLE settings ADD COLUMN reminder_include_location INTEGER DEFAULT 1;");
  } catch {}
  try {
    db.exec("ALTER TABLE settings ADD COLUMN reminder_location_text TEXT DEFAULT 'Sede Central Autoescuela (Av. de la Constitución, 12)';");
  } catch {}
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN booking_id TEXT;");
  } catch {}

  seedDefaultData();
}

// Seed Initial Data if necessary
function seedDefaultData() {
  const targetAdminEmail = 'alvaroq.dev@gmail.com';
  const targetAdminPassword = 'admin05';
  const legacyAdminEmail = 'alvaroq.dev@gmail.com';

  // Check if legacy admin exists and update credentials to requested ones
  const legacyAdmin = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(legacyAdminEmail) as { id: string } | undefined;
  if (legacyAdmin) {
    const updatedAuth = hashPassword(targetAdminPassword);
    db.prepare(`
      UPDATE users 
      SET email = ?, password_hash = ?, salt = ?, updated_at = ?
      WHERE id = ?
    `).run(targetAdminEmail, updatedAuth.hash, updatedAuth.salt, new Date().toISOString(), legacyAdmin.id);
    console.log(`[Database Migration] Credenciales de admin actualizadas de ${legacyAdminEmail} a ${targetAdminEmail}`);
  }

  // Ensure target admin exists and has target password
  const checkTargetAdmin = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(targetAdminEmail) as { id: string } | undefined;
  if (checkTargetAdmin) {
    const targetAuth = hashPassword(targetAdminPassword);
    db.prepare(`
      UPDATE users
      SET password_hash = ?, salt = ?, role = 'admin', updated_at = ?
      WHERE id = ?
    `).run(targetAuth.hash, targetAuth.salt, new Date().toISOString(), checkTargetAdmin.id);
  }

  const checkAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
  
  // Initialize settings if empty
  const checkSettings = db.prepare('SELECT id FROM settings LIMIT 1').get();
  if (!checkSettings) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO settings (
        id, class_duration_minutes, rest_time_minutes, min_cancellation_hours,
        reminder_enabled, reminder_hours_before, reminder_title_template,
        reminder_message_template, reminder_channel, reminder_include_location,
        reminder_location_text, timezone, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      45,
      0,
      24,
      1,
      24,
      'Recordatorio: Clase práctica - {fecha} a las {hora}',
      'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!',
      'both',
      1,
      'Sede Central Autoescuela (Av. de la Constitución, 12)',
      'Europe/Madrid',
      now
    );
  }

  if (checkAdmin) {
    return; // Already seeded
  }

  console.log('Seeding initial data for Autoescuela...');
  const now = new Date().toISOString();

  // 1. Admin User (alvaroq.dev@gmail.com / admin05)
  const adminAuth = hashPassword(targetAdminPassword);
  const adminId = 'usr_admin_01';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, phone, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    adminId,
    targetAdminEmail,
    adminAuth.hash,
    adminAuth.salt,
    'Administrador Central',
    '+34 912 345 678',
    'admin',
    now,
    now
  );

  // 2. Sample Student (alvaroq@gmail.com / alumno05)
  const studentAuth = hashPassword('alumno05');
  const studentId = 'usr_student_01';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, phone, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studentId,
    'alvaroq@gmail.com',
    studentAuth.hash,
    studentAuth.salt,
    'Álvaro Quevedo Gómez',
    '+34 667 743 219',
    'student',
    now,
    now
  );

  // 3. Teachers: Juan García, María López, Alvaro Quevedo
  const teacher1Id = 'tch_juan_01';
  const teacher2Id = 'tch_maria_02';
  const teacher3Id = 'tch_alvaro_03';

  db.prepare(`
    INSERT INTO teachers (id, name, last_name, email, phone, photo_url, is_active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    teacher1Id,
    'Juan',
    'García Moreno',
    'juan.garcia@autoescuela.es',
    '+34 612 345 678',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    1,
    'Profesor titular especialista en circuito abierto, examen práctico y conducción segura en autopista.',
    now,
    now
  );

  db.prepare(`
    INSERT INTO teachers (id, name, last_name, email, phone, photo_url, is_active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    teacher2Id,
    'María',
    'López Fernández',
    'maria.lopez@autoescuela.es',
    '+34 623 456 789',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    1,
    'Profesora especialista en estacionamiento, maniobras de precisión y superación del miedo a conducir.',
    now,
    now
  );
   db.prepare(`
    INSERT INTO teachers (id, name, last_name, email, phone, photo_url, is_active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    teacher3Id,
    'Álvaro',
    'Quevedo Gómez',
    'alvaroq.dev@gmail.com',
    '+34 667 743 219',
    'https://images.unsplash.com/photo-1695927621677-ec96e048dce2?w=150&auto=format&fit=crop&q=80',
    1,
    'Profesor especializado en motos.',
    now,
    now
  );

  // 4. Agendas for teachers
  const schedule1Id = 'sch_juan_01';
  const schedule2Id = 'sch_maria_02';
  const schedule3Id = 'sch_alvaro_03';

  db.prepare(`
    INSERT INTO schedules (id, teacher_id, name, start_date, end_date, is_active, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule1Id,
    teacher1Id,
    'Horario Principal - Juan García',
    '2026-01-01',
    null,
    1,
    'Europe/Madrid',
    now,
    now
  );

  db.prepare(`
    INSERT INTO schedules (id, teacher_id, name, start_date, end_date, is_active, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule2Id,
    teacher2Id,
    'Horario Principal - María López',
    '2026-01-01',
    null,
    1,
    'Europe/Madrid',
    now,
    now
  );

   db.prepare(`
    INSERT INTO schedules (id, teacher_id, name, start_date, end_date, is_active, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule3Id,
    teacher3Id,
    'Horario Principal - Álvaro Quevedo',
    '2026-01-01',
    null,
    1,
    'Europe/Madrid',
    now,
    now
  );

  // Weekly hours: Monday to Friday: 09:00 - 13:00 and 16:00 - 20:00, Saturday: 09:00 - 13:00
  const insertWeeklyHour = db.prepare(`
    INSERT INTO schedule_weekly_hours (id, schedule_id, day_of_week, start_time, end_time)
    VALUES (?, ?, ?, ?, ?)
  `);

  const schedules = [schedule1Id, schedule2Id, schedule3Id];
  for (const schId of schedules) {
    // Days 1 to 5 (Lunes a Viernes)
    for (let day = 1; day <= 5; day++) {
      insertWeeklyHour.run(crypto.randomUUID(), schId, day, '09:00', '13:00');
      insertWeeklyHour.run(crypto.randomUUID(), schId, day, '16:00', '20:00');
    }
    // Day 6 (Sábado)
    insertWeeklyHour.run(crypto.randomUUID(), schId, 6, '09:00', '13:00');
  }

  // 5. Seed a realistic sample upcoming booking and past booking for Álvaro
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 3);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO bookings (id, student_id, teacher_id, schedule_id, date, start_time, end_time, duration_minutes, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'bk_sample_01',
    studentId,
    teacher1Id,
    schedule1Id,
    tomorrowStr,
    '10:30',
    '11:15',
    45,
    'Reservada',
    'Práctica en rotondas y vías interurbanas.',
    now,
    now
  );

  db.prepare(`
    INSERT INTO bookings (id, student_id, teacher_id, schedule_id, date, start_time, end_time, duration_minutes, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'bk_sample_02',
    studentId,
    teacher2Id,
    schedule2Id,
    yesterdayStr,
    '16:00',
    '16:45',
    45,
    'Completada',
    'Primera clase de maniobras de estacionamiento en línea y batería.',
    now,
    now
  );

  // 6. Audit log entry
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    adminId,
    'Administrador Central',
    'alvaroq.dev@gmail.com',
    'Inicialización del sistema',
    'system',
    'default',
    'Se configuraron los profesores iniciales (Juan García y María López), agendas semanales y ajustes de clase.',
    now
  );

  // 7. Notification for Carlos
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    studentId,
    'booking_created',
    'Clase reservada con éxito',
    `Tienes una clase reservada para mañana ${tomorrowStr} a las 10:30 con Juan García.`,
    0,
    now
  );

  console.log('Autoescuela default data successfully initialized!');
}
