import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name?: string;

  /** false hides the topic from students; its questions keep it. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
