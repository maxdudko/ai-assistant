import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum MemoryType {
  FACTUAL = 'FACTUAL',
  REFLECTION = 'REFLECTION',
}

export class MemoryCandidateDto {
  @IsString()
  content: string;

  @IsEnum(MemoryType)
  type: MemoryType;

  @IsInt()
  @Min(1)
  @Max(10)
  importance: number;

  @IsOptional()
  tags?: string[];

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}
