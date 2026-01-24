import { IsUUID } from 'class-validator';

export class ConfirmActionDto {
  @IsUUID()
  actionId: string;
}
