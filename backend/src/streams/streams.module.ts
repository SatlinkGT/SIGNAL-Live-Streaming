import { Module } from '@nestjs/common';
import { StreamsController } from './stream.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [StreamsController],
})
export class StreamsModule {}
