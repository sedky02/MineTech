import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class ReorderQuestionsDto {
  /** Question ids of one list, in the new order (first = highest priority). */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}
