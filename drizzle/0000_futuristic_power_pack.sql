CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_name" text,
	"user_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"schedule_id" text,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'Reservada' NOT NULL,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"booking_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text,
	"date" text NOT NULL,
	"is_full_day" integer DEFAULT 1 NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_weekly_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"class_duration_minutes" integer DEFAULT 45 NOT NULL,
	"rest_time_minutes" integer DEFAULT 0 NOT NULL,
	"min_cancellation_hours" integer DEFAULT 24 NOT NULL,
	"reminder_enabled" integer DEFAULT 1 NOT NULL,
	"reminder_hours_before" integer DEFAULT 24 NOT NULL,
	"reminder_title_template" text,
	"reminder_message_template" text,
	"reminder_channel" text DEFAULT 'both',
	"reminder_include_location" integer DEFAULT 1,
	"reminder_location_text" text,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"photo_url" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text,
	"email" text NOT NULL,
	"password_hash" text,
	"salt" text,
	"name" text NOT NULL,
	"phone" text,
	"avatar_url" text,
	"role" text DEFAULT 'student' NOT NULL,
	"google_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_hours" ADD CONSTRAINT "schedule_weekly_hours_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_teacher_date" ON "bookings" USING btree ("teacher_id","date");--> statement-breakpoint
CREATE INDEX "idx_bookings_student" ON "bookings" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_date" ON "schedule_blocks" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_schedules_teacher" ON "schedules" USING btree ("teacher_id");