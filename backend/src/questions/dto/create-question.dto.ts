import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateQuestionDto {
  /** Category slug; checked against active categories in the service. */
  @IsString()
  @Length(1, 64)
  category: string;

  @Transform(trim)
  @IsString()
  @Length(10, 500)
  content: string;

  @Transform(({ value }: { value: unknown }) => {
    const trimmed = trim({ value });
    return trimmed === '' || trimmed === null ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;
}
