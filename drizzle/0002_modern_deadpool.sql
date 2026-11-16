CREATE TABLE "thoughts" (
	"id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"author_id" text NOT NULL,
	"discussed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thoughts" ADD CONSTRAINT "thoughts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;