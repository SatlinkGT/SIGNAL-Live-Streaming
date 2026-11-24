import { IsEmail, IsString, MinLength, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  @MinLength(3)
  @MaxLength(40)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
