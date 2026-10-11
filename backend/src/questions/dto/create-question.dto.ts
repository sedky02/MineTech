import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CATEGORY_SLUGS } from '../../common/categories.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateQuestionDto {
  /** Topic slug from the fixed list (src/common/categories.ts). */
  @IsIn(CATEGORY_SLUGS, { message: 'Invalid category' })
  category: string;

  @Transform(trim)
  @IsString()
  @Length(1, 500)
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
