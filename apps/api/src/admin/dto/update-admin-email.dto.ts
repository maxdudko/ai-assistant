import { IsEmail } from 'class-validator';

export class UpdateAdminEmailDto {
  @IsEmail()
  email: string;
}
