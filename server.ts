import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase, hashPassword, verifyPassword } from './server/db.ts';
import {
  createToken,
  authenticateToken,
  requireAuth,
  requireAdmin,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  generateSlotsForDate,
  createBookingAtomic,
  getAppSettings,
  timeToMinutes,
} from './server/slots.ts';
import {
  sendEmail,
  sendClassReminderEmail,
  sendStudentWelcomeEmail,
  isResendConfigured,
  getSenderEmail,
  isSandboxDomain,
  getAuthorizedTestEmail,
} from './server/email.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';

function formatToDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : dateStr;
}

async function startServer() {
  await initDatabase();

  // Auto-complete bookings whose end_time has already passed
  await autoCompletePassedBookings();
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(authenticateToken);

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, phone } = req.body;
      if (!email || !password || !name) {
        res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        return;
      }

      // Check existing email
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        res.status(409).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
        return;
      }

      const { hash, salt } = hashPassword(password);
      const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await db.prepare(`
        INSERT INTO users (id, email, password_hash, salt, name, phone, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'student', ?, ?)
      `).run(userId, email.trim().toLowerCase(), hash, salt, name.trim(), phone?.trim() || null, now, now);

      const user = {
        id: userId,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone?.trim() || null,
        role: 'student' as const,
        created_at: now,
      };

      const token = createToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      // Audit log
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Registro de usuario', 'user', ?, 'Nuevo alumno registrado en la plataforma', ?)
      `).run(crypto.randomUUID(), user.id, user.name, user.email, user.id, now);

      res.status(201).json({ user, token });
    } catch (err: any) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Error al registrar el usuario: ' + (err.message || 'desconocido') });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email y contraseña requeridos.' });
        return;
      }

      const row = (await db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())) as any;
      if (!row || !row.password_hash || !row.salt) {
        res.status(401).json({ error: 'Credenciales incorrectas o usuario no registrado.' });
        return;
      }

      const isValid = verifyPassword(password, row.password_hash, row.salt);
      if (!isValid) {
        res.status(401).json({ error: 'Credenciales incorrectas.' });
        return;
      }

      const user = {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        avatar_url: row.avatar_url,
        role: row.role as 'admin' | 'student',
        created_at: row.created_at,
      };

      const token = createToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      res.json({ user, token });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Error en inicio de sesión: ' + (err.message || 'desconocido') });
    }
  });

  // Google OAuth / Firebase sign in
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { idToken } = req.body;

      if (!idToken || typeof idToken !== 'string') {
        res.status(400).json({
          error: 'Token de Firebase no proporcionado.',
        });
        return;
      }

      // Firebase verifica que el token pertenece realmente a un usuario autenticado.
      const decodedToken = await adminAuth.verifyIdToken(idToken);

      const email = decodedToken.email;

      if (!email) {
        res.status(400).json({
          error: 'La cuenta de Google no tiene un correo electrónico válido.',
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const name =
        decodedToken.name ||
        normalizedEmail.split('@')[0] ||
        'Usuario Google';

      const googleId = decodedToken.uid;
      const avatarUrl = decodedToken.picture || null;
      const now = new Date().toISOString();

      let row = (
        await db
          .prepare('SELECT * FROM users WHERE email = ?')
          .get(normalizedEmail)
      ) as any;

      if (row) {
        // La cuenta ya existe: asociamos la cuenta de Firebase.
        await db
          .prepare(`
          UPDATE users
          SET google_id = COALESCE(google_id, ?),
              avatar_url = COALESCE(avatar_url, ?),
              updated_at = ?
          WHERE id = ?
        `)
          .run(
            googleId,
            avatarUrl,
            now,
            row.id
          );

        row = (
          await db
            .prepare('SELECT * FROM users WHERE id = ?')
            .get(row.id)
        ) as any;
      } else {
        // Crear nuevo alumno.
        const newUserId = `usr_g_${crypto.randomUUID().slice(0, 8)}`;

        await db
          .prepare(`
          INSERT INTO users (
            id,
            email,
            name,
            avatar_url,
            role,
            google_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 'student', ?, ?, ?)
        `)
          .run(
            newUserId,
            normalizedEmail,
            name.trim(),
            avatarUrl,
            googleId,
            now,
            now
          );

        row = (
          await db
            .prepare('SELECT * FROM users WHERE id = ?')
            .get(newUserId)
        ) as any;

        // Audit log.
        await db
          .prepare(`
          INSERT INTO audit_logs (
            id,
            user_id,
            user_name,
            user_email,
            action,
            entity_type,
            entity_id,
            details,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .run(
            crypto.randomUUID(),
            row.id,
            row.name,
            row.email,
            'Registro con Google',
            'user',
            row.id,
            'Nuevo usuario registrado vía Google',
            now
          );
      }

      const user = {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        avatar_url: row.avatar_url,
        role: row.role as 'admin' | 'student',
        created_at: row.created_at,
      };

      // Token propio de AutoescuelaPro.
      const token = createToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.json({
        user,
        token,
      });
    } catch (err: any) {
      console.error('Google auth error:', err);

      res.status(401).json({
        error: 'No se pudo verificar la autenticación con Google.',
      });
    }
  });

  // Current User Info
  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const row = (await db.prepare('SELECT id, email, name, phone, avatar_url, role, created_at FROM users WHERE id = ?').get(req.user!.id)) as any;
      if (!row) {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
      res.json({ user: row });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Profile
  app.put('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, phone, avatar_url } = req.body;
      if (!name) {
        res.status(400).json({ error: 'El nombre no puede estar vacío.' });
        return;
      }
      const now = new Date().toISOString();
      await db.prepare(`
        UPDATE users SET name = ?, phone = ?, avatar_url = ?, updated_at = ?
        WHERE id = ?
      `).run(name.trim(), phone?.trim() || null, avatar_url || null, now, req.user!.id);

      const row = (await db.prepare('SELECT id, email, name, phone, avatar_url, role, created_at FROM users WHERE id = ?').get(req.user!.id)) as any;
      res.json({ user: row });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Forgot Password Request
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Introduce tu email.' });
        return;
      }
      const user = (await db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email.trim().toLowerCase())) as any;
      if (!user) {
        res.json({ message: 'Si el correo está registrado, se han enviado las instrucciones de recuperación.' });
        return;
      }

      const token = 'rst_' + crypto.randomBytes(20).toString('hex');
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      await db.prepare(`
        INSERT OR REPLACE INTO password_resets (token, email, expires_at, used)
        VALUES (?, ?, ?, 0)
      `).run(token, user.email, expiresAt);

      res.json({
        message: 'Código de recuperación generado.',
        resetToken: token,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset Password Execution
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(400).json({ error: 'Token y nueva contraseña requeridos.' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        return;
      }

      const reset = (await db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(token)) as any;
      if (!reset) {
        res.status(400).json({ error: 'Token de recuperación inválido o ya utilizado.' });
        return;
      }

      if (new Date(reset.expires_at) < new Date()) {
        res.status(400).json({ error: 'El enlace de recuperación ha caducado.' });
        return;
      }

      const { hash, salt } = hashPassword(newPassword);
      const now = new Date().toISOString();

      await db.prepare(`
        UPDATE users SET password_hash = ?, salt = ?, updated_at = ?
        WHERE email = ?
      `).run(hash, salt, now, reset.email);

      await db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(token);

      res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // TEACHERS MANAGEMENT
  // ==========================================

  app.get('/api/teachers', async (req: AuthenticatedRequest, res) => {
    try {
      const isAdmin = req.user?.role === 'admin';
      let query = 'SELECT * FROM teachers';
      if (!isAdmin) {
        query += ' WHERE is_active = 1';
      }
      query += ' ORDER BY is_active DESC, name ASC';
      const rows = (await db.prepare(query).all()) as any[];
      const teachers = rows.map(t => ({
        ...t,
        is_active: Boolean(Number(t.is_active)),
      }));
      res.json({ teachers });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/teachers', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, last_name, email, phone, photo_url, notes, is_active } = req.body;
      if (!name || !last_name) {
        res.status(400).json({ error: 'Nombre y apellidos son requeridos.' });
        return;
      }

      const id = 'tch_' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      const activeInt = is_active === false ? 0 : 1;

      await db.prepare(`
        INSERT INTO teachers (id, name, last_name, email, phone, photo_url, is_active, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name.trim(), last_name.trim(), email?.trim() || null, phone?.trim() || null, photo_url?.trim() || null, activeInt, notes?.trim() || null, now, now);

      // Audit
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Creación de profesor', 'teacher', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        id,
        `Profesor ${name} ${last_name} creado.`,
        now
      );

      const teacher = (await db.prepare('SELECT * FROM teachers WHERE id = ?').get(id)) as any;
      res.status(201).json({ teacher: { ...teacher, is_active: Boolean(Number(teacher.is_active)) } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/teachers/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { name, last_name, email, phone, photo_url, notes, is_active } = req.body;

      const existing = (await db.prepare('SELECT * FROM teachers WHERE id = ?').get(id)) as any;
      if (!existing) {
        res.status(404).json({ error: 'Profesor no encontrado.' });
        return;
      }

      const now = new Date().toISOString();
      const activeInt = is_active !== undefined ? (is_active ? 1 : 0) : Number(existing.is_active);

      await db.prepare(`
        UPDATE teachers SET
          name = COALESCE(?, name),
          last_name = COALESCE(?, last_name),
          email = ?,
          phone = ?,
          photo_url = ?,
          is_active = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        name?.trim() || null,
        last_name?.trim() || null,
        email !== undefined ? (email?.trim() || null) : existing.email,
        phone !== undefined ? (phone?.trim() || null) : existing.phone,
        photo_url !== undefined ? (photo_url?.trim() || null) : existing.photo_url,
        activeInt,
        notes !== undefined ? (notes?.trim() || null) : existing.notes,
        now,
        id
      );

      // Audit
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Modificación de profesor', 'teacher', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        id,
        `Profesor ${existing.name} ${existing.last_name} actualizado (Estado: ${activeInt ? 'Activo' : 'Inactivo'}).`,
        now
      );

      const teacher = (await db.prepare('SELECT * FROM teachers WHERE id = ?').get(id)) as any;
      res.json({ teacher: { ...teacher, is_active: Boolean(Number(teacher.is_active)) } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete/Deactivate Teacher
  app.delete('/api/teachers/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const teacher = (await db.prepare('SELECT * FROM teachers WHERE id = ?').get(id)) as any;
      if (!teacher) {
        res.status(404).json({ error: 'Profesor no encontrado.' });
        return;
      }

      const bookingCount = (await db.prepare('SELECT COUNT(*) as count FROM bookings WHERE teacher_id = ?').get(id)) as any;
      const now = new Date().toISOString();
      const count = Number(bookingCount?.count || 0);

      if (count > 0) {
        // Deactivate to preserve historical bookings
        await db.prepare('UPDATE teachers SET is_active = 0, updated_at = ? WHERE id = ?').run(now, id);
        await db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, 'Desactivación de profesor (Histórico)', 'teacher', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          req.user!.email,
          id,
          `Profesor ${teacher.name} ${teacher.last_name} desactivado (conservando ${count} reservas históricas).`,
          now
        );
        res.json({ message: 'El profesor tiene reservas registradas. Ha sido marcado como inactivo para proteger el historial.' });
      } else {
        await db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
        await db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, 'Eliminación física de profesor', 'teacher', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          req.user!.email,
          id,
          `Profesor ${teacher.name} ${teacher.last_name} eliminado.`,
          now
        );
        res.json({ message: 'Profesor eliminado correctamente.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SCHEDULES & WEEKLY HOURS
  // ==========================================

  app.get('/api/schedules', async (req, res) => {
    try {
      const { teacher_id } = req.query;
      let query = `
        SELECT s.*, t.name as teacher_name, t.last_name as teacher_last_name
        FROM schedules s
        JOIN teachers t ON s.teacher_id = t.id
      `;
      const args: any[] = [];
      if (teacher_id) {
        query += ' WHERE s.teacher_id = ?';
        args.push(teacher_id);
      }
      query += ' ORDER BY s.start_date DESC';

      const schedules = (await db.prepare(query).all(...args)) as any[];

      const result = await Promise.all(
        schedules.map(async s => {
          const weekly_hours = (await db.prepare(`
            SELECT * FROM schedule_weekly_hours
            WHERE schedule_id = ?
            ORDER BY day_of_week ASC, start_time ASC
          `).all(s.id)) as any[];
          return {
            ...s,
            teacher_name: `${s.teacher_name} ${s.teacher_last_name}`,
            is_active: Boolean(Number(s.is_active)),
            weekly_hours,
          };
        })
      );

      res.json({ schedules: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/schedules', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { teacher_id, name, start_date, end_date, is_active, timezone, weekly_hours } = req.body;
      if (!teacher_id || !name || !start_date) {
        res.status(400).json({ error: 'Profesor, nombre y fecha de inicio son requeridos.' });
        return;
      }

      const id = 'sch_' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      const activeInt = is_active === false ? 0 : 1;

      await db.exec('BEGIN;');
      try {
        await db.prepare(`
          INSERT INTO schedules (id, teacher_id, name, start_date, end_date, is_active, timezone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, teacher_id, name.trim(), start_date, end_date || null, activeInt, timezone || 'Europe/Madrid', now, now);

        if (Array.isArray(weekly_hours)) {
          for (const wh of weekly_hours) {
            await db.prepare(`
              INSERT INTO schedule_weekly_hours (id, schedule_id, day_of_week, start_time, end_time)
              VALUES (?, ?, ?, ?, ?)
            `).run(crypto.randomUUID(), id, Number(wh.day_of_week), wh.start_time, wh.end_time);
          }
        }

        await db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, 'Creación de agenda', 'schedule', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          req.user!.email,
          id,
          `Agenda '${name}' creada para profesor id ${teacher_id}.`,
          now
        );

        await db.exec('COMMIT;');
        res.status(201).json({ id, message: 'Agenda creada con éxito.' });
      } catch (e) {
        await db.exec('ROLLBACK;');
        throw e;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/schedules/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { name, start_date, end_date, is_active, timezone, weekly_hours } = req.body;
      const now = new Date().toISOString();

      await db.exec('BEGIN;');
      try {
        const existing = (await db.prepare('SELECT * FROM schedules WHERE id = ?').get(id)) as any;
        if (!existing) {
          res.status(404).json({ error: 'Agenda no encontrada.' });
          return;
        }

        const activeInt = is_active !== undefined ? (is_active ? 1 : 0) : Number(existing.is_active);

        await db.prepare(`
          UPDATE schedules SET
            name = COALESCE(?, name),
            start_date = COALESCE(?, start_date),
            end_date = ?,
            is_active = ?,
            timezone = COALESCE(?, timezone),
            updated_at = ?
          WHERE id = ?
        `).run(
          name?.trim() || null,
          start_date || null,
          end_date !== undefined ? (end_date || null) : existing.end_date,
          activeInt,
          timezone || null,
          now,
          id
        );

        if (Array.isArray(weekly_hours)) {
          await db.prepare('DELETE FROM schedule_weekly_hours WHERE schedule_id = ?').run(id);
          for (const wh of weekly_hours) {
            await db.prepare(`
              INSERT INTO schedule_weekly_hours (id, schedule_id, day_of_week, start_time, end_time)
              VALUES (?, ?, ?, ?, ?)
            `).run(crypto.randomUUID(), id, Number(wh.day_of_week), wh.start_time, wh.end_time);
          }
        }

        await db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, 'Modificación de agenda', 'schedule', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          req.user!.email,
          id,
          `Agenda id ${id} actualizada.`,
          now
        );

        await db.exec('COMMIT;');
        res.json({ message: 'Agenda actualizada con éxito.' });
      } catch (e) {
        await db.exec('ROLLBACK;');
        throw e;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/schedules/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Eliminación de agenda', 'schedule', ?, 'Agenda eliminada.', ?)
      `).run(crypto.randomUUID(), req.user!.id, req.user!.name, req.user!.email, id, new Date().toISOString());
      res.json({ message: 'Agenda eliminada.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // BLOCKS & EXCEPTIONS
  // ==========================================

  app.get('/api/blocks', async (req, res) => {
    try {
      const { date, teacher_id } = req.query;
      let query = `
        SELECT b.*, t.name as teacher_name, t.last_name as teacher_last_name
        FROM schedule_blocks b
        LEFT JOIN teachers t ON b.teacher_id = t.id
      `;
      const args: any[] = [];
      const conditions: string[] = [];
      if (date) {
        conditions.push('b.date = ?');
        args.push(date);
      }
      if (teacher_id) {
        conditions.push('(b.teacher_id IS NULL OR b.teacher_id = ?)');
        args.push(teacher_id);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY b.date DESC, b.created_at DESC';

      const rows = (await db.prepare(query).all(...args)) as any[];
      const blocks = rows.map(b => ({
        ...b,
        teacher_name: b.teacher_name ? `${b.teacher_name} ${b.teacher_last_name}` : 'Todos los profesores',
        is_full_day: Boolean(Number(b.is_full_day)),
      }));
      res.json({ blocks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/blocks', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { teacher_id, date, is_full_day, start_time, end_time, reason } = req.body;
      if (!date || !reason) {
        res.status(400).json({ error: 'Fecha y motivo del bloqueo son obligatorios.' });
        return;
      }
      const fullDayInt = is_full_day ? 1 : 0;
      if (!fullDayInt && (!start_time || !end_time)) {
        res.status(400).json({ error: 'Para bloqueos parciales se deben especificar hora de inicio y fin.' });
        return;
      }

      const id = 'blk_' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await db.prepare(`
        INSERT INTO schedule_blocks (id, teacher_id, date, is_full_day, start_time, end_time, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        teacher_id || null,
        date,
        fullDayInt,
        fullDayInt ? null : start_time,
        fullDayInt ? null : end_time,
        reason.trim(),
        now
      );

      // Audit
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Creación de bloqueo/excepción', 'block', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        id,
        `Bloqueo creado para fecha ${formatToDisplayDate(date)} (${fullDayInt ? 'Día completo' : `${start_time}-${end_time}`}): ${reason}`,
        now
      );

      res.status(201).json({ id, message: 'Bloqueo registrado correctamente.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/blocks/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await db.prepare('DELETE FROM schedule_blocks WHERE id = ?').run(id);
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Eliminación de bloqueo', 'block', ?, 'Bloqueo eliminado.', ?)
      `).run(crypto.randomUUID(), req.user!.id, req.user!.name, req.user!.email, id, new Date().toISOString());
      res.json({ message: 'Bloqueo eliminado.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SLOTS & CALENDAR AVAILABILITY
  // ==========================================

  app.get('/api/slots', async (req: AuthenticatedRequest, res) => {
    try {
      const { date, teacher_id } = req.query;
      if (!date || typeof date !== 'string') {
        res.status(400).json({ error: 'Parámetro date (YYYY-MM-DD) requerido.' });
        return;
      }

      const studentId = req.user?.role === 'student' ? req.user.id : undefined;
      const slots = await generateSlotsForDate({
        teacherId: typeof teacher_id === 'string' && teacher_id ? teacher_id : undefined,
        date,
        studentId,
      });

      res.json({ date, slots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/calendar-availability', async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month, teacher_id } = req.query;
      if (!year || !month) {
        res.status(400).json({ error: 'Año y mes requeridos.' });
        return;
      }
      const y = Number(year);
      const m = Number(month);
      const daysInMonth = new Date(y, m, 0).getDate();
      const availability: Record<string, { total: number; available: number }> = {};
      const teacherId = typeof teacher_id === 'string' && teacher_id ? teacher_id : undefined;
      const studentId = req.user?.role === 'student' ? req.user.id : undefined;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const slots = await generateSlotsForDate({ teacherId, date: dateStr, studentId });
        const available = slots.filter(s => s.is_available).length;
        availability[dateStr] = {
          total: slots.length,
          available,
        };
      }

      res.json({ year: y, month: m, availability });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // BOOKINGS & RESERVATIONS
  // ==========================================


  // Automatically update status of bookings that have already finished (date + end_time passed)
  async function autoCompletePassedBookings(): Promise<number> {
    try {
      const settings = await getAppSettings();
      const tz = settings.timezone || 'Europe/Madrid';
      const now = new Date();
      const currentDate = now.toLocaleDateString('en-CA', { timeZone: tz }); // "YYYY-MM-DD"
      const currentTime = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }); // "HH:mm"
      const nowIso = now.toISOString();

      const res = await db.prepare(`
        UPDATE bookings
        SET status = 'Completada', updated_at = ?
        WHERE status = 'Reservada'
          AND (date < ? OR (date = ? AND end_time <= ?))
      `).run(nowIso, currentDate, currentDate, currentTime);

      return Number(res.changes || 0);
    } catch (err) {
      console.error('Error auto-completing passed bookings:', err);
      return 0;
    }
  }

  app.get('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await autoCompletePassedBookings();
      const isAdmin = req.user!.role === 'admin';
      const { student_id, teacher_id, status, date, start_date, end_date } = req.query;

      let query = `
        SELECT b.*,
               u.name as student_name, u.email as student_email, u.phone as student_phone,
               t.name as teacher_name, t.last_name as teacher_last_name
        FROM bookings b
        JOIN users u ON b.student_id = u.id
        JOIN teachers t ON b.teacher_id = t.id
      `;

      const conditions: string[] = [];
      const args: any[] = [];

      if (!isAdmin) {
        conditions.push('b.student_id = ?');
        args.push(req.user!.id);
      } else {
        if (student_id) {
          conditions.push('b.student_id = ?');
          args.push(student_id);
        }
      }

      if (teacher_id) {
        conditions.push('b.teacher_id = ?');
        args.push(teacher_id);
      }
      if (status) {
        conditions.push('b.status = ?');
        args.push(status);
      }
      if (date) {
        conditions.push('b.date = ?');
        args.push(date);
      }
      if (start_date) {
        conditions.push('b.date >= ?');
        args.push(start_date);
      }
      if (end_date) {
        conditions.push('b.date <= ?');
        args.push(end_date);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY b.date DESC, b.start_time DESC';

      const rows = (await db.prepare(query).all(...args)) as any[];
      const bookings = rows.map(b => ({
        ...b,
        teacher_name: `${b.teacher_name} ${b.teacher_last_name}`,
      }));

      res.json({ bookings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { teacher_id, date, start_time, notes, student_id } = req.body;
      const isAdmin = req.user!.role === 'admin';

      let targetStudentId = req.user!.id;
      if (isAdmin && student_id) {
        targetStudentId = student_id;
      }

      if (!teacher_id || !date || !start_time) {
        res.status(400).json({ error: 'Profesor, fecha y hora de inicio son requeridos.' });
        return;
      }

      const booking = await createBookingAtomic({
        studentId: targetStudentId,
        teacherId: teacher_id,
        date,
        startTime: start_time,
        notes,
        creatorUser: {
          id: req.user!.id,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
        },
      });

      res.status(201).json({ booking, message: '¡Clase reservada con éxito!' });
    } catch (err: any) {
      console.error('Booking creation error:', err);
      const message = err.message || 'Error al procesar la reserva.';
      const status = message.includes('ya ha sido reservado') || message.includes('Ya tienes otra clase') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/bookings/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const isAdmin = req.user!.role === 'admin';

      const booking = (await db.prepare(`
        SELECT b.*, u.name as student_name, u.email as student_email,
               t.name as teacher_name, t.last_name as teacher_last_name
        FROM bookings b
        JOIN users u ON b.student_id = u.id
        JOIN teachers t ON b.teacher_id = t.id
        WHERE b.id = ?
      `).get(id)) as any;

      if (!booking) {
        res.status(404).json({ error: 'Reserva no encontrada.' });
        return;
      }

      if (!isAdmin && booking.student_id !== req.user!.id) {
        res.status(403).json({ error: 'No tienes permiso para cancelar esta reserva.' });
        return;
      }

      if (booking.status.startsWith('Cancelada')) {
        res.status(400).json({ error: 'Esta reserva ya se encuentra cancelada.' });
        return;
      }

      const settings = await getAppSettings();
      if (!isAdmin) {
        const [year, month, day] = booking.date.split('-').map(Number);
        const [hour, min] = booking.start_time.split(':').map(Number);
        const bookingDate = new Date(year, month - 1, day, hour, min, 0);
        const now = new Date();
        const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 3600);

        if (diffHours < settings.min_cancellation_hours) {
          res.status(400).json({
            error: `No es posible cancelar la clase con menos de ${settings.min_cancellation_hours} horas de antelación. Por favor contacta con la autoescuela si tienes una urgencia.`,
          });
          return;
        }
      }

      const newStatus = isAdmin ? 'Cancelada por administrador' : 'Cancelada por alumno';
      const now = new Date().toISOString();

      await db.prepare(`
        UPDATE bookings SET status = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?
      `).run(newStatus, reason ? `Cancelación: ${reason}` : null, now, id);

      // Audit
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Cancelación de reserva', 'booking', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        id,
        `Reserva para ${booking.student_name} (${formatToDisplayDate(booking.date)} ${booking.start_time}) cancelada por ${req.user!.name} (${isAdmin ? 'Admin' : 'Alumno'}). Motivo: ${reason || 'Sin especificar'}.`,
        now
      );

      // Notification to Student
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        booking.student_id,
        'booking_cancelled',
        'Clase cancelada',
        `Tu clase del ${formatToDisplayDate(booking.date)} a las ${booking.start_time} con ${booking.teacher_name} ${booking.teacher_last_name} ha sido cancelada.`,
        0,
        now
      );

      res.json({ message: 'Reserva cancelada correctamente. El slot ha quedado disponible nuevamente.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/bookings/:id/status', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const allowedStatuses = ['Reservada', 'Cancelada por alumno', 'Cancelada por administrador', 'Completada', 'No presentado'];

      if (!allowedStatuses.includes(status)) {
        res.status(400).json({ error: 'Estado no válido.' });
        return;
      }

      const booking = (await db.prepare('SELECT student_id, date, start_time, end_time FROM bookings WHERE id = ?').get(id)) as any;
      if (!booking) {
        res.status(404).json({ error: 'Reserva no encontrada.' });
        return;
      }

      // If the booking is already in the past, it cannot be changed to 'Reservada'
      if (status === 'Reservada') {
        const settings = await getAppSettings();
        const tz = settings.timezone || 'Europe/Madrid';
        const nowObj = new Date();
        const currentDate = nowObj.toLocaleDateString('en-CA', { timeZone: tz });
        const currentTime = nowObj.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });

        const isPassed = booking.date < currentDate || (booking.date === currentDate && booking.end_time <= currentTime);
        if (isPassed) {
          res.status(400).json({
            error: 'No es posible cambiar a "Reservada" una clase cuya fecha y hora ya han finalizado.'
          });
          return;
        }
      }

      const now = new Date().toISOString();
      await db.prepare(`
        UPDATE bookings SET status = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?
      `).run(status, notes || null, now, id);

      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Cambio de estado de reserva', 'booking', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        id,
        `Estado de reserva id ${id} actualizado a '${status}'.`,
        now
      );

      if (booking) {
        await db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
          VALUES (?, ?, 'booking_status', 'Actualización de clase', ?, 0, ?)
        `).run(
          crypto.randomUUID(),
          booking.student_id,
          `Tu clase del ${formatToDisplayDate(booking.date)} a las ${booking.start_time} ahora figura como '${status}'.`,
          now
        );
      }

      res.json({ message: `Estado actualizado a ${status}.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // CONFIGURATION & SETTINGS
  // ==========================================

  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await getAppSettings();
      res.json({ settings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        school_name,
        class_duration_minutes,
        rest_time_minutes,
        min_cancellation_hours,
        reminder_enabled,
        reminder_hours_before,
        reminder_title_template,
        reminder_message_template,
        reminder_channel,
        reminder_include_location,
        reminder_location_text,
        timezone,
      } = req.body;

      if (!class_duration_minutes || class_duration_minutes < 15) {
        res.status(400).json({ error: 'La duración de las clases debe ser de al menos 15 minutos.' });
        return;
      }

      const now = new Date().toISOString();
      const finalSchoolName = school_name && typeof school_name === 'string' && school_name.trim() ? school_name.trim() : 'AutoescuelaPro';

      await db.prepare(`
        school_name = ?,
        UPDATE settings SET
          class_duration_minutes = ?,
          rest_time_minutes = ?,
          min_cancellation_hours = ?,
          reminder_enabled = ?,
          reminder_hours_before = ?,
          reminder_title_template = ?,
          reminder_message_template = ?,
          reminder_channel = ?,
          reminder_include_location = ?,
          reminder_location_text = ?,
          timezone = ?,
          updated_at = ?
        WHERE id = 'default'
      `).run(
        finalSchoolName,
        Number(class_duration_minutes),
        Number(rest_time_minutes || 0),
        Number(min_cancellation_hours || 24),
        reminder_enabled ? 1 : 0,
        Number(reminder_hours_before || 24),
        reminder_title_template || 'Recordatorio: Clase práctica - {fecha} a las {hora}',
        reminder_message_template || 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!',
        reminder_channel || 'both',
        reminder_include_location === false ? 0 : 1,
        reminder_location_text || 'Sede Central Autoescuela (Av. de la Constitución, 12)',
        timezone || 'Europe/Madrid',
        now
      );

      // Audit
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Modificación de configuración', 'settings', 'default', ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        `Configuración actualizada: Autoescuela: "${finalSchoolName}", Recordatorios (${reminder_enabled ? 'Activados' : 'Desactivados'}, antelación: ${reminder_hours_before}h). Duración clase: ${class_duration_minutes}m.`,
        now
      );

      res.json({ settings: await getAppSettings(), message: 'Configuración de recordatorios y sistema guardada correctamente.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // STUDENTS LIST & ADMIN STATS
  // ==========================================

  app.get('/api/students', requireAdmin, async (req, res) => {
    try {
      await autoCompletePassedBookings();
      const rows = (await db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.is_active, u.created_at,
               COUNT(b.id) as total_bookings,
               SUM(CASE WHEN b.status = 'Completada' THEN 1 ELSE 0 END) as completed_classes,
               SUM(CASE WHEN b.status = 'Reservada' THEN 1 ELSE 0 END) as active_classes
        FROM users u
        LEFT JOIN bookings b ON u.id = b.student_id
        WHERE u.role = 'student'
        GROUP BY u.id
        ORDER BY u.name ASC
      `).all()) as any[];

      const students = rows.map(s => ({
        ...s,
        is_active: s.is_active === null || s.is_active === undefined ? true : Boolean(Number(s.is_active)),
        total_bookings: Number(s.total_bookings || 0),
        completed_classes: Number(s.completed_classes || 0),
        active_classes: Number(s.active_classes || 0),
      }));

      res.json({ students });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // Create a new student by Admin Central
  app.post('/api/students', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, email, phone, password } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ error: 'El nombre y apellidos del alumno son obligatorios.' });
        return;
      }

      if (!email || !email.trim()) {
        res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = (await db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(normalizedEmail)) as any;
      if (existingUser) {
        res.status(400).json({
          error: `Ya existe un usuario registrado en el sistema con el correo "${normalizedEmail}".`,
        });
        return;
      }

      // Password: Use provided or generate a friendly, secure temporary password
      const initialPassword = password && password.trim().length >= 6
        ? password.trim()
        : `Auto${Math.floor(100000 + Math.random() * 900000)}!`;

      const { hash, salt } = hashPassword(initialPassword);
      const studentId = `usr_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db.prepare(`
        INSERT INTO users (id, email, password_hash, salt, name, phone, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'student', 1, ?, ?)
      `).run(
        studentId,
        normalizedEmail,
        hash,
        salt,
        name.trim(),
        phone?.trim() || null,
        now,
        now
      );

      // Audit log
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Alta de alumno por Administrador', 'user', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        studentId,
        `Alta de alumno: ${name.trim()} (${normalizedEmail})`,
        now
      );

      // Determine application URL for email link
      const appUrl = (
        req.get('origin') ||
        req.get('referer') ||
        process.env.APP_URL ||
        ''
      ).replace(/\/$/, '');

      // Send Welcome / Onboarding Email to student
      let emailResult = null;
      try {
        const appSettings = await getAppSettings();
        emailResult = await sendStudentWelcomeEmail({
          to: normalizedEmail,
          studentName: name.trim(),
          temporaryPassword: initialPassword,
          appUrl,
          schoolName: appSettings.school_name || 'AutoescuelaPro',
        });
      } catch (emailErr: any) {
        console.warn('[Welcome Email Warning]', emailErr.message || emailErr);
        emailResult = {
          success: false,
          error: emailErr.message || 'Error al enviar correo de bienvenida',
          configured: false,
        };
      }

      const student = {
        id: studentId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        avatar_url: null,
        role: 'student',
        is_active: true,
        total_bookings: 0,
        completed_classes: 0,
        active_classes: 0,
        created_at: now,
      };

      res.status(201).json({
        message: 'Alumno dado de alta correctamente.',
        student,
        initialPassword,
        emailResult,
      });
    } catch (err: any) {
      console.error('Error creating student:', err);
      res.status(500).json({ error: 'Error al registrar alumno: ' + (err.message || 'desconocido') });
    }
  });

  // Update student by Admin Central
  app.put('/api/students/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, password, is_active } = req.body;

      const existing = (await db.prepare('SELECT * FROM users WHERE id = ? AND role = "student"').get(id)) as any;
      if (!existing) {
        res.status(404).json({ error: 'Alumno no encontrado.' });
        return;
      }

      if (!name || !name.trim()) {
        res.status(400).json({ error: 'El nombre y apellidos son obligatorios.' });
        return;
      }

      if (!email || !email.trim()) {
        res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if email taken by someone else
      const conflict = (await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, id)) as any;
      if (conflict) {
        res.status(400).json({ error: `Ya existe otro usuario con el correo "${normalizedEmail}".` });
        return;
      }

      const now = new Date().toISOString();
      const activeInt = is_active === undefined || is_active === null ? Number(existing.is_active ?? 1) : (is_active ? 1 : 0);

      // If deactivated, cancel pending future bookings
      if (activeInt === 0 && Number(existing.is_active ?? 1) === 1) {
        await db.prepare(`
          UPDATE bookings
          SET status = 'Cancelada', notes = 'Cancelada automáticamente por baja del alumno', updated_at = ?
         WHERE student_id = ? AND status = 'Reservada'
        `).run(now, id);
      }

      // Update password if provided
      if (password && password.trim().length >= 6) {
        const { hash, salt } = hashPassword(password.trim());
        await db.prepare(`
          UPDATE users
          SET name = ?, email = ?, phone = ?, password_hash = ?, salt = ?, is_active = ?, updated_at = ?
          WHERE id = ?
        `).run(name.trim(), normalizedEmail, phone?.trim() || null, hash, salt, activeInt, now, id);
      } else {
        await db.prepare(`
          UPDATE users
          SET name = ?, email = ?, phone = ?, is_active = ?, updated_at = ?
          WHERE id = ?
        `).run(name.trim(), normalizedEmail, phone?.trim() || null, activeInt, now, id);
      }

      // Audit log
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Modificación de alumno', 'user', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        id,
        `Alumno ${name.trim()} (${normalizedEmail}) modificado (Estado: ${activeInt ? 'Activo' : 'Inactivo / Baja'}).`,
        now
      );

      const updated = (await db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.is_active, u.created_at,
               COUNT(b.id) as total_bookings,
               SUM(CASE WHEN b.status = 'Completada' THEN 1 ELSE 0 END) as completed_classes,
               SUM(CASE WHEN b.status = 'Reservada' THEN 1 ELSE 0 END) as active_classes
        FROM users u
        LEFT JOIN bookings b ON u.id = b.student_id
        WHERE u.id = ?
        GROUP BY u.id
      `).get(id)) as any;

      res.json({
        message: 'Alumno actualizado correctamente.',
        student: {
          ...updated,
          is_active: Boolean(Number(updated.is_active)),
          total_bookings: Number(updated.total_bookings || 0),
          completed_classes: Number(updated.completed_classes || 0),
          active_classes: Number(updated.active_classes || 0),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al actualizar alumno.' });
    }
  });

  // Delete or Deactivate student by Admin Central (Intelligent Deletion)
  app.delete('/api/students/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const student = (await db.prepare('SELECT id, name, email, is_active FROM users WHERE id = ? AND role = "student"').get(id)) as any;

      if (!student) {
        res.status(404).json({ error: 'Alumno no encontrado.' });
        return;
      }

      const bookingCount = (await db.prepare('SELECT COUNT(*) as count FROM bookings WHERE student_id = ?').get(id)) as any;
      const count = Number(bookingCount?.count || 0);
      const now = new Date().toISOString();

      if (count > 0) {
        // Soft delete / baja lógica: cancel active bookings and deactivate
        await db.prepare(`
          UPDATE bookings
          SET status = 'Cancelada', notes = 'Cancelada automáticamente por baja del alumno', updated_at = ?
         WHERE student_id = ? AND status = 'Reservada'
        `).run(now, id);

        await db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(now, id);

        await db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, 'Baja de alumno (Histórico protegido)', 'user', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          req.user!.email,
          id,
          `El alumno ${student.name} (${student.email}) tiene ${count} clases registradas. Ha sido dado de baja protegiendo el histórico.`,
          now
        );

        res.json({
          action: 'deactivated',
          message: `El alumno tiene ${count} clases en su historial. Para proteger las estadísticas y registros de la autoescuela, ha sido dado de baja y sus reservas activas pendientes han sido canceladas.`,
        });
      } else {
        // Physical permanent deletion
        await db.prepare('DELETE FROM users WHERE id = ?').run(id);

        await db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, 'Eliminación física de alumno', 'user', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          req.user!.email,
          id,
          `Alumno ${student.name} (${student.email}) eliminado permanentemente (sin historial de clases).`,
          now
        );

        res.json({
          action: 'deleted',
          message: 'Alumno eliminado permanentemente del sistema.',
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al eliminar alumno.' });
    }
  });

  // Resend welcome email to an existing student
  app.post('/api/students/:id/resend-welcome', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const student = (await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id)) as any;

      if (!student) {
        res.status(404).json({ error: 'Alumno no encontrado.' });
        return;
      }

      const appUrl = (
        req.get('origin') ||
        req.get('referer') ||
        process.env.APP_URL ||
        ''
      ).replace(/\/$/, '');
      const appSettings = await getAppSettings();
      const emailResult = await sendStudentWelcomeEmail({
        to: student.email,
        studentName: student.name,
        appUrl,
        schoolName: appSettings.school_name || 'AutoescuelaPro',
      });

      // Audit log
      await db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, 'Reenvío de email de bienvenida', 'user', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        req.user!.id,
        req.user!.name,
        req.user!.email,
        student.id,
        `Reenvío de correo de acceso a ${student.name} (${student.email})`,
        new Date().toISOString()
      );

      res.json({
        message: `Correo de acceso reenviado correctamente a ${student.email}.`,
        emailResult,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al reenviar correo.' });
    }
  });

  app.get('/api/stats', requireAdmin, async (req, res) => {
    try {
      await autoCompletePassedBookings();
      const todayStr = new Date().toISOString().split('T')[0];

      const todayClasses = (await db.prepare(`
        SELECT COUNT(*) as count FROM bookings
        WHERE date = ? AND status IN ('Reservada', 'Completada')
      `).get(todayStr)) as any;

      const upcomingClasses = (await db.prepare(`
        SELECT COUNT(*) as count FROM bookings
         WHERE date >= ? AND status = 'Reservada'
      `).get(todayStr)) as any;

      const totalBookings = (await db.prepare('SELECT COUNT(*) as count FROM bookings').get()) as any;
      const activeTeachers = (await db.prepare('SELECT COUNT(*) as count FROM teachers WHERE is_active = 1').get()) as any;
      const registeredStudents = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get()) as any;
      const cancelledClasses = (await db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status LIKE 'Cancelada%'").get()) as any;

      // Available slots today
      const slotsToday = await generateSlotsForDate({ date: todayStr });
      const availableSlotsToday = slotsToday.filter(s => s.is_available).length;

      res.json({
        stats: {
          today_classes: Number(todayClasses?.count || 0),
          upcoming_classes: Number(upcomingClasses?.count || 0),
          total_bookings: Number(totalBookings?.count || 0),
          active_teachers: Number(activeTeachers?.count || 0),
          registered_students: Number(registeredStudents?.count || 0),
          available_slots_today: availableSlotsToday,
          cancelled_classes: Number(cancelledClasses?.count || 0),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  app.get('/api/audit-logs', requireAdmin, async (req, res) => {
    try {
      const logs = await db.prepare(`
        SELECT * FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 100
      `).all();
      res.json({ logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const notifications = (await db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).all(req.user!.id)) as any[];

      res.json({ notifications: notifications.map(n => ({ ...n, read: Boolean(Number(n.read)) })) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(id, req.user!.id);
      res.json({ message: 'Notificación leída.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Function to process automatic class reminders
  async function processAutomaticReminders(): Promise<{ sent: number; emails_dispatched: number; checked: number; message: string }> {
    const settings = await getAppSettings();
    if (!settings.reminder_enabled) {
      return { sent: 0, emails_dispatched: 0, checked: 0, message: 'Los recordatorios automáticos están desactivados en la configuración.' };
    }

    const hoursBefore = Math.max(1, Number(settings.reminder_hours_before) || 24);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

    const nowStr = now.toISOString().split('T')[0];
    const windowEndStr = windowEnd.toISOString().split('T')[0];

    const bookings = (await db.prepare(`
      SELECT b.*, u.name as student_name, u.email as student_email,
             t.name as teacher_name, t.last_name as teacher_last_name
      FROM bookings b
      JOIN users u ON b.student_id = u.id
      JOIN teachers t ON b.teacher_id = t.id
      WHERE b.status = 'Reservada'
        AND b.date >= ? AND b.date <= ?
    `).all(nowStr, windowEndStr)) as any[];

    let sentCount = 0;
    let emailDispatchedCount = 0;

    for (const b of bookings) {
      const [bYear, bMonth, bDay] = b.date.split('-').map(Number);
      const [bHour, bMin] = b.start_time.split(':').map(Number);
      const bookingDateTime = new Date(bYear, bMonth - 1, bDay, bHour, bMin, 0);
      if (isNaN(bookingDateTime.getTime())) continue;

      if (bookingDateTime > now && bookingDateTime <= windowEnd) {
        const alreadySent = await db.prepare(`
          SELECT id FROM notifications
          WHERE (booking_id = ? AND type = 'reminder')
             OR (user_id = ? AND type = 'reminder' AND message LIKE ?)
          LIMIT 1
        `).get(b.id, b.student_id, `%${b.date}%${b.start_time}%`);

        if (alreadySent) continue;

        const dateParts = b.date.split('-');
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : b.date;
        const teacherFullName = `${b.teacher_name} ${b.teacher_last_name}`.trim();

        const titleTemplate = settings.reminder_title_template || 'Recordatorio: Clase práctica - {fecha} a las {hora}';
        let messageTemplate = settings.reminder_message_template || 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min).';

        if (settings.reminder_include_location && settings.reminder_location_text && !messageTemplate.includes('{ubicacion}')) {
          messageTemplate += ` Punto de encuentro: ${settings.reminder_location_text}.`;
        }

        const replacePlaceholders = (template: string) => {
          return template
            .replace(/{alumno}/g, b.student_name || 'Alumno')
            .replace(/{profesor}/g, teacherFullName)
            .replace(/{fecha}/g, formattedDate)
            .replace(/{hora}/g, b.start_time)
            .replace(/{duracion}/g, String(b.duration_minutes || 45))
            .replace(/{ubicacion}/g, settings.reminder_location_text || '')
            .replace(/{autoescuela}/g, settings.school_name || 'AutoescuelaPro');
        };

        const title = replacePlaceholders(titleTemplate);
        const message = replacePlaceholders(messageTemplate);
        const nowIso = new Date().toISOString();

        // 1. In-app notification
        await db.prepare(`
          INSERT INTO notifications (id, user_id, booking_id, type, title, message, read, created_at)
          VALUES (?, ?, ?, 'reminder', ?, ?, 0, ?)
        `).run(crypto.randomUUID(), b.student_id, b.id, title, message, nowIso);

        sentCount++;

        // 2. Real email via Resend if channel is 'both' or 'email'
        const shouldSendEmail = (settings.reminder_channel === 'both' || settings.reminder_channel === 'email') && b.student_email;
        if (shouldSendEmail) {
          try {
            sendClassReminderEmail({
              to: b.student_email,
              studentName: b.student_name || 'Alumno',
              teacherName: teacherFullName,
              date: formattedDate,
              time: b.start_time,
              durationMinutes: b.duration_minutes || 45,
              location: settings.reminder_location_text,
              customTitle: title,
              customMessage: message,
              schoolName: settings.school_name || 'AutoescuelaPro',
            }).catch(err => {
              console.error(`[Resend Auto-Reminder] Error enviando correo a ${b.student_email}:`, err);
            });
            emailDispatchedCount++;
          } catch (emailErr) {
            console.error('[Resend Auto-Reminder] Error en envío:', emailErr);
          }
        }
      }
    }

    const emailNote = (settings.reminder_channel === 'both' || settings.reminder_channel === 'email')
      ? (isResendConfigured()
        ? ` (${emailDispatchedCount} correo(s) enviados con Resend)`
        : ' (Aviso: RESEND_API_KEY no configurada aún, los correos reales quedan en espera)')
      : '';

    return {
      sent: sentCount,
      emails_dispatched: emailDispatchedCount,
      checked: bookings.length,
      message: sentCount > 0
        ? `Se han emitido ${sentCount} recordatorio(s) de clases automáticos a los alumnos (antelación: ${hoursBefore}h)${emailNote}.`
        : `Comprobación finalizada. No hay clases pendientes de recordatorio en la ventana de las próximas ${hoursBefore} horas.`,
    };
  }

  // Check Resend email service status
  app.get('/api/notifications/resend-status', requireAdmin, (req, res) => {
    try {
      res.json({
        configured: isResendConfigured(),
        sender: getSenderEmail(),
        isSandbox: isSandboxDomain(),
        authorizedTestEmail: getAuthorizedTestEmail(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated test endpoint for sending a real email via Resend
  app.post('/api/notifications/test-email', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const dbUser = (await db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.user!.id)) as any;
      let recipient = req.body?.to?.trim() || dbUser?.email || req.user!.email;

      if (!recipient || recipient.includes('example.com')) {
        const adminInDb = (await db.prepare("SELECT email FROM users WHERE role = 'admin' AND email NOT LIKE '%example.com%' LIMIT 1").get()) as any;
        if (adminInDb?.email) {
          recipient = adminInDb.email;
        } else {
          recipient = getAuthorizedTestEmail();
        }
      }

      const settings = await getAppSettings();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedDate = `${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}/${tomorrow.getFullYear()}`;

      const emailRes = await sendClassReminderEmail({
        to: recipient,
        studentName: req.user!.name || 'Usuario Administrador',
        teacherName: 'Manuel Serrano (Profesor de prueba)',
        date: formattedDate,
        time: '10:00',
        durationMinutes: settings.class_duration_minutes || 45,
        location: settings.reminder_location_text || 'Sede Central Autoescuela',
        customTitle: `[PRUEBA REAL RESEND] Clase práctica - ${formattedDate} a las 10:00`,
        customMessage: `¡Hola! Este es un correo electrónico real de prueba generado desde ${settings.school_name || 'AutoescuelaPro'} mediante la API de Resend para validar la correcta recepción y diseño.`,
        schoolName: settings.school_name || 'AutoescuelaPro',
      });

      if (!emailRes.configured) {
        res.status(400).json({
          success: false,
          configured: false,
          error: 'RESEND_API_KEY no está configurada en las variables de entorno del servidor. Por favor, añádela en la configuración del proyecto.',
          recipient,
        });
        return;
      }

      if (!emailRes.success) {
        res.status(400).json({
          success: false,
          configured: true,
          error: emailRes.error || 'Resend rechazó la solicitud de envío.',
          recipient,
        });
        return;
      }

      const message = emailRes.redirected
        ? `Correo de prueba enviado con éxito a ${emailRes.actualRecipient} (Modo Sandbox de Resend: redirigido automáticamente desde ${emailRes.originalRecipient}).`
        : `¡Correo de prueba enviado con éxito a ${emailRes.actualRecipient || recipient} a través de Resend!`;

      res.json({
        success: true,
        configured: true,
        id: emailRes.id,
        recipient: emailRes.actualRecipient || recipient,
        original_recipient: emailRes.originalRecipient,
        redirected: Boolean(emailRes.redirected),
        message,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send a test reminder notification to the logged-in administrator (in-app + email)
  app.post('/api/notifications/test-reminder', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await getAppSettings();
      const {
        title_template,
        message_template,
        location_text,
        include_location,
        send_real_email,
      } = req.body;

      const titleTpl = title_template || settings.reminder_title_template || 'Recordatorio: Clase práctica - {fecha} a las {hora}';
      let messageTpl = message_template || settings.reminder_message_template || 'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min).';
      const locText = location_text || settings.reminder_location_text || 'Sede Central Autoescuela (Av. de la Constitución, 12)';
      const inclLoc = include_location !== undefined ? Boolean(include_location) : Boolean(settings.reminder_include_location);

      if (inclLoc && locText && !messageTpl.includes('{ubicacion}')) {
        messageTpl += ` Punto de encuentro: ${locText}.`;
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const year = tomorrow.getFullYear();
      const sampleDate = `${day}/${month}/${year}`;

      const replacePlaceholders = (template: string) => {
        return template
          .replace(/{alumno}/g, req.user!.name || 'Carlos Gómez')
          .replace(/{profesor}/g, 'Manuel Serrano')
          .replace(/{fecha}/g, sampleDate)
          .replace(/{hora}/g, '10:00')
          .replace(/{duracion}/g, '45')
          .replace(/{ubicacion}/g, locText)
          .replace(/{autoescuela}/g, settings.school_name || 'AutoescuelaPro');
      };

      const title = replacePlaceholders(titleTpl);
      const message = replacePlaceholders(messageTpl);
      const now = new Date().toISOString();

      // 1. In-app notification
      await db.prepare(`
        INSERT INTO notifications (id, user_id, booking_id, type, title, message, read, created_at)
        VALUES (?, ?, NULL, 'reminder', ?, ?, 0, ?)
      `).run(crypto.randomUUID(), req.user!.id, `[PRUEBA] ${title}`, message, now);

      // 2. Real email if requested
      let emailResult: any = null;
      const shouldEmail = Boolean(send_real_email) || settings.reminder_channel === 'both' || settings.reminder_channel === 'email';
      if (shouldEmail && req.user?.email) {
        emailResult = await sendClassReminderEmail({
          to: req.user.email,
          studentName: req.user.name || 'Alumno',
          teacherName: 'Manuel Serrano',
          date: sampleDate,
          time: '10:00',
          durationMinutes: 45,
          location: locText,
          customTitle: `[PRUEBA] ${title}`,
          customMessage: message,
          schoolName: settings.school_name || 'AutoescuelaPro',
        });
      }

      res.json({
        message: 'Notificación de prueba generada en la campana superior' + (emailResult?.success ? ` y correo enviado a ${req.user!.email}` : '.'),
        preview: { title: `[PRUEBA] ${title}`, message },
        email_result: emailResult,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manually trigger processing of pending automatic reminders
  app.post('/api/notifications/process-reminders', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await processAutomaticReminders();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get log of sent reminder notifications
  app.get('/api/notifications/reminders-log', requireAdmin, async (req, res) => {
    try {
      const logs = (await db.prepare(`
        SELECT n.*, u.name as student_name, u.email as student_email
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.type = 'reminder'
        ORDER BY n.created_at DESC
        LIMIT 30
      `).all()) as any[];

      res.json({
        reminders: logs.map(l => ({
          ...l,
          read: Boolean(Number(l.read)),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Setup periodic interval for automatic reminders every 5 minutes
  setInterval(async () => {
    try {
      await processAutomaticReminders();
    } catch (e) {
      console.error('Periodic automatic reminder scan error:', e);
    }
  }, 5 * 60 * 1000);

  // Periodically auto-complete passed bookings every 60 seconds
  setInterval(async () => {
    try {
      await autoCompletePassedBookings();
    } catch (e) {
      console.error('Periodic auto-completion error:', e);
    }
  }, 60 * 1000);

  // ==========================================
  // VITE DEV MIDDLEWARE / STATIC ASSETS
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Autoescuela server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
