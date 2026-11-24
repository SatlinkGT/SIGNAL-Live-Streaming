CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_channelSlug_timestamp_id_idx" ON "chat_messages"("channelSlug", "timestamp", "id");
CREATE INDEX "chat_messages_timestamp_idx" ON "chat_messages"("timestamp");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channelSlug_fkey"
    FOREIGN KEY ("channelSlug") REFERENCES "channels"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
