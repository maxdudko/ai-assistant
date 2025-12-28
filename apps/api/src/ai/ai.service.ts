import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async generateStubResponse(message: string): Promise<string> {
    return `PMA (stub): I received your message: "${message}"`;
  }
}
