ALTER TABLE "ActionExecutionLog"
ADD COLUMN "reversible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "undoPayload" JSONB;
