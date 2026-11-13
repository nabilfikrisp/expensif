ALTER TABLE "messages" RENAME COLUMN "external_chat_id" TO "external_conversation_id";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_external_source_unique";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "external_conversation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_idempotency_key_key" UNIQUE("idempotency_key");