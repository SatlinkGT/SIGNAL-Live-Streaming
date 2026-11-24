ALTER TABLE "channels" ADD COLUMN "inputProtocol" TEXT NOT NULL DEFAULT 'rtmp';
ALTER TABLE "channels" ADD CONSTRAINT "channels_inputProtocol_check" CHECK ("inputProtocol" IN ('rtmp', 'srt'));
