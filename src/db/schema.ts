import { pgTable, text, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
    id: text('id').primaryKey(),
    uid: text('uid').unique(), // Firebase Auth UID
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    salt: text('salt'),
    name: text('name').notNull(),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('student'),
    isActive: integer('is_active').notNull().default(1),
    googleId: text('google_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
});

// Teachers table
export const teachers = pgTable('teachers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    photoUrl: text('photo_url'),
    isActive: integer('is_active').notNull().default(1),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
});

// Schedules table
export const schedules = pgTable('schedules', {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id').notNull().references(() => teachers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    isActive: integer('is_active').notNull().default(1),
    timezone: text('timezone').notNull().default('Europe/Madrid'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
}, (table) => [
    index('idx_schedules_teacher').on(table.teacherId),
]);

// Weekly hours for schedules
export const scheduleWeeklyHours = pgTable('schedule_weekly_hours', {
    id: text('id').primaryKey(),
    scheduleId: text('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
});

// Schedule exception blocks (vacations, holidays, off days)
export const scheduleBlocks = pgTable('schedule_blocks', {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    isFullDay: integer('is_full_day').notNull().default(1),
    startTime: text('start_time'),
    endTime: text('end_time'),
    reason: text('reason').notNull(),
    createdAt: text('created_at').notNull(),
}, (table) => [
    index('idx_blocks_date').on(table.date),
]);

// Bookings table
export const bookings = pgTable('bookings', {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id').notNull().references(() => teachers.id),
    scheduleId: text('schedule_id'),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    status: text('status').notNull().default('Reservada'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
}, (table) => [
    index('idx_bookings_teacher_date').on(table.teacherId, table.date),
    index('idx_bookings_student').on(table.studentId),
]);

// App Settings
export const settings = pgTable('settings', {
    id: text('id').primaryKey(),
    schoolName: text('school_name').default('AutoescuelaPro'),
    classDurationMinutes: integer('class_duration_minutes').notNull().default(45),
    restTimeMinutes: integer('rest_time_minutes').notNull().default(0),
    minCancellationHours: integer('min_cancellation_hours').notNull().default(24),
    reminderEnabled: integer('reminder_enabled').notNull().default(1),
    reminderHoursBefore: integer('reminder_hours_before').notNull().default(24),
    reminderTitleTemplate: text('reminder_title_template'),
    reminderMessageTemplate: text('reminder_message_template'),
    reminderChannel: text('reminder_channel').default('both'),
    reminderIncludeLocation: integer('reminder_include_location').default(1),
    reminderLocationText: text('reminder_location_text'),
    timezone: text('timezone').notNull().default('Europe/Madrid'),
    updatedAt: text('updated_at').notNull(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    userName: text('user_name'),
    userEmail: text('user_email'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    details: text('details'),
    createdAt: text('created_at').notNull(),
});

// Notifications
export const notifications = pgTable('notifications', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bookingId: text('booking_id'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    read: integer('read').notNull().default(0),
    createdAt: text('created_at').notNull(),
});

// Password Resets
export const passwordResets = pgTable('password_resets', {
    token: text('token').primaryKey(),
    email: text('email').notNull(),
    expiresAt: text('expires_at').notNull(),
    used: integer('used').notNull().default(0),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    bookings: many(bookings),
    notifications: many(notifications),
}));

export const teachersRelations = relations(teachers, ({ many }) => ({
    schedules: many(schedules),
    bookings: many(bookings),
    blocks: many(scheduleBlocks),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
    teacher: one(teachers, {
        fields: [schedules.teacherId],
        references: [teachers.id],
    }),
    weeklyHours: many(scheduleWeeklyHours),
}));

export const scheduleWeeklyHoursRelations = relations(scheduleWeeklyHours, ({ one }) => ({
    schedule: one(schedules, {
        fields: [scheduleWeeklyHours.scheduleId],
        references: [schedules.id],
    }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
    student: one(users, {
        fields: [bookings.studentId],
        references: [users.id],
    }),
    teacher: one(teachers, {
        fields: [bookings.teacherId],
        references: [teachers.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));
