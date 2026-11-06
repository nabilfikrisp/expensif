-- Keep preflight, source deletion, and constraint changes atomic against concurrent writes.
LOCK TABLE "expenses", "messages" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
DECLARE
  incompatible jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'amount', amount::text, 'currency', currency))
  INTO incompatible
  FROM "expenses"
  WHERE NOT (amount > 0 AND amount < 'Infinity'::numeric AND amount = trunc(amount))
     OR currency <> 'IDR';

  IF incompatible IS NOT NULL THEN
    RAISE EXCEPTION 'Incompatible expenses; migration aborted without changing data'
      USING DETAIL = incompatible::text;
  END IF;
END $$;
--> statement-breakpoint
-- Maintainer authorized deleting legacy sources without a backfill.
-- The existing FK keeps expenses and sets their message_id to null.
DO $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM "messages";
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % legacy messages without complete external source identity', deleted_count;
END $$;
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_external_message_id_key";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "platform" text NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "external_chat_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE numeric USING "amount"::numeric;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_external_source_unique" UNIQUE("platform","external_chat_id","external_message_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive_finite_whole" CHECK ("amount" > 0 AND "amount" < 'Infinity'::numeric AND "amount" = trunc("amount"));--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_idr" CHECK ("currency" = 'IDR');
