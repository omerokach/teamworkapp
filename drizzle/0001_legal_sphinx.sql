CREATE TABLE "workspace_access" (
	"email" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invitation_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
