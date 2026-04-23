CREATE TABLE "agent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_user_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_providers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_prompts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"forked_from_id" uuid,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_templates_org_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "agent_templates" ADD CONSTRAINT "agent_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_templates" ADD CONSTRAINT "agent_templates_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_templates_org_idx" ON "agent_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_templates_public_idx" ON "agent_templates" USING btree ("is_public");