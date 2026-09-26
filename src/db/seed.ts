import crypto from 'node:crypto';
import { createPool, db } from './index.ts';
import * as schema from './schema.ts';

function hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
}

async function seed() {
    console.log('🌱 [Seed] Iniciando población de la base de datos...');
    const pool = createPool();

    try {
        const now = new Date().toISOString();

        // 1. Configuración general de la autoescuela (Settings)
        console.log('⚙️ [Seed] Verificando configuración general...');
        await db
            .insert(schema.settings)
            .values({
                id: 'default',
                schoolName: 'AutoescuelaPro',
                classDurationMinutes: 45,
                restTimeMinutes: 0,
                minCancellationHours: 24,
                reminderEnabled: 1,
                reminderHoursBefore: 24,
                reminderTitleTemplate: 'Recordatorio: Clase práctica - {fecha} a las {hora}',
                reminderMessageTemplate:
                    'Hola {alumno}, te recordamos tu clase práctica con {profesor} programada para el {fecha} a las {hora} ({duracion} min). ¡No olvides llevar tu documentación!',
                reminderChannel: 'both',
                reminderIncludeLocation: 1,
                reminderLocationText: 'Sede Central Autoescuela (Av. de la Constitución, 12)',
                timezone: 'Europe/Madrid',
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: schema.settings.id,
                set: {
                    classDurationMinutes: 45,
                    reminderChannel: 'both',
                    timezone: 'Europe/Madrid',
                    updatedAt: now,
                },
            });

        // 2. Usuarios del sistema (Administradores y Alumnos)
        console.log('👥 [Seed] Creando usuarios y administradores...');
        const adminPass = hashPassword('admin05');
        const studentPass = hashPassword('alumno05');

        // Admin con credenciales fijas
        await db
            .insert(schema.users)
            .values({
                id: 'usr_admin_01',
                email: 'alvaroq.dev@gmail.com',
                name: 'Administrador Central',
                role: 'admin',
                phone: '+34 942 345 678',
                passwordHash: adminPass.hash,
                salt: adminPass.salt,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: schema.users.email,
                set: {
                    role: 'admin',
                    updatedAt: now,
                },
            });

        // Alumno demo de pruebas
        await db
            .insert(schema.users)
            .values({
                id: 'usr_student_01',
                email: 'alvaroq@gmail.com',
                name: 'Álvaro Quevedo Gómez',
                role: 'student',
                phone: '+34 667 321 987',
                passwordHash: studentPass.hash,
                salt: studentPass.salt,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: schema.users.email,
                set: {
                    role: 'student',
                    updatedAt: now,
                },
            });

        // 3. Profesores
        console.log('🚗 [Seed] Registrando profesores de la autoescuela...');
        const teachersData = [
            {
                id: 'tch_juan_01',
                name: 'Juan',
                lastName: 'García Moreno',
                email: 'juan.garcia@autoescuela.es',
                phone: '+34 612 345 678',
                photoUrl:
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                isActive: 1,
                notes:
                    'Profesor titular especialista en circuito abierto, examen práctico y conducción segura en autopista.',
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'tch_maria_02',
                name: 'María',
                lastName: 'López Fernández',
                email: 'maria.lopez@autoescuela.es',
                phone: '+34 623 456 789',
                photoUrl:
                    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
                isActive: 1,
                notes:
                    'Profesora especialista en estacionamiento, maniobras de precisión y superación del miedo a conducir.',
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'tch_carlos_03',
                name: 'Carlos',
                lastName: 'Mendoza Navarro',
                email: 'carlos.mendoza@autoescuela.es',
                phone: '+34 634 567 890',
                photoUrl:
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
                isActive: 1,
                notes:
                    'Instructor de refuerzo, experto en seguridad vial y primeros auxilios aplicados a la conducción.',
                createdAt: now,
                updatedAt: now,
            },
        ];

        for (const t of teachersData) {
            await db
                .insert(schema.teachers)
                .values(t)
                .onConflictDoUpdate({
                    target: schema.teachers.id,
                    set: {
                        name: t.name,
                        lastName: t.lastName,
                        email: t.email,
                        phone: t.phone,
                        photoUrl: t.photoUrl,
                        notes: t.notes,
                        isActive: t.isActive,
                        updatedAt: now,
                    },
                });
        }

        // 4. Agendas de los Profesores (Schedules)
        console.log('📅 [Seed] Configurando agendas y cuadrantes de disponibilidad...');
        const schedulesData = [
            {
                id: 'sch_juan_01',
                teacherId: 'tch_juan_01',
                name: 'Horario Principal - Juan García',
                startDate: '2026-01-01',
                endDate: null,
                isActive: 1,
                timezone: 'Europe/Madrid',
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'sch_maria_02',
                teacherId: 'tch_maria_02',
                name: 'Horario Principal - María López',
                startDate: '2026-01-01',
                endDate: null,
                isActive: 1,
                timezone: 'Europe/Madrid',
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'sch_carlos_03',
                teacherId: 'tch_carlos_03',
                name: 'Horario Principal - Carlos Mendoza',
                startDate: '2026-01-01',
                endDate: null,
                isActive: 1,
                timezone: 'Europe/Madrid',
                createdAt: now,
                updatedAt: now,
            },
        ];

        for (const s of schedulesData) {
            await db
                .insert(schema.schedules)
                .values(s)
                .onConflictDoUpdate({
                    target: schema.schedules.id,
                    set: {
                        name: s.name,
                        isActive: s.isActive,
                        updatedAt: now,
                    },
                });
        }

        // 5. Horas semanales (Lunes a Viernes, Mañanas 09:00-13:00 y Tardes 16:00-20:00)
        console.log('⏰ [Seed] Definiendo tramos semanales por día...');
        // Días de la semana: 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes
        const defaultDays = [1, 2, 3, 4, 5];

        for (const s of schedulesData) {
            for (const day of defaultDays) {
                // Mañana
                const morningId = `wh_${s.id}_d${day}_m`;
                await db
                    .insert(schema.scheduleWeeklyHours)
                    .values({
                        id: morningId,
                        scheduleId: s.id,
                        dayOfWeek: day,
                        startTime: '09:00',
                        endTime: '13:00',
                    })
                    .onConflictDoNothing();

                // Tarde
                const afternoonId = `wh_${s.id}_d${day}_a`;
                await db
                    .insert(schema.scheduleWeeklyHours)
                    .values({
                        id: afternoonId,
                        scheduleId: s.id,
                        dayOfWeek: day,
                        startTime: '16:00',
                        endTime: '20:00',
                    })
                    .onConflictDoNothing();
            }
        }

        // 6. Reservas de ejemplo para tener clases visibles en el calendario
        console.log('📑 [Seed] Asegurando clases prácticas de muestra...');
        const sampleBookings = [
            {
                id: 'bk_sample_01',
                studentId: 'usr_student_01',
                teacherId: 'tch_juan_01',
                scheduleId: 'sch_juan_01',
                date: '2026-09-24',
                startTime: '10:30',
                endTime: '11:15',
                durationMinutes: 45,
                status: 'Reservada',
                notes: 'Práctica en rotondas y vías interurbanas.',
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'bk_sample_02',
                studentId: 'usr_student_01',
                teacherId: 'tch_maria_02',
                scheduleId: 'sch_maria_02',
                date: '2026-09-20',
                startTime: '16:00',
                endTime: '16:45',
                durationMinutes: 45,
                status: 'Completada',
                notes: 'Primera clase de maniobras de estacionamiento en línea y batería.',
                createdAt: now,
                updatedAt: now,
            },
        ];

        for (const bk of sampleBookings) {
            await db
                .insert(schema.bookings)
                .values(bk)
                .onConflictDoNothing();
        }

        console.log('✅ [Seed] ¡Base de datos poblada con éxito!');
        console.log('--------------------------------------------------');
        console.log('🔑 Credenciales disponibles:');
        console.log('   - Admin (Email): alvaroq.dev@gmail.com / admin05');
        console.log('   - Alumno demo: alvaroq@gmail.com / alumno05');
        console.log('   - Profesores: Juan García Moreno, María López Fernández, Carlos Mendoza');
        console.log('--------------------------------------------------');
    } catch (error) {
        console.error('❌ [Seed] Error al poblar la base de datos:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seed();
