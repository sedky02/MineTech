import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from '../common/decorators/auth.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

/** Topic management for the moderator dashboard. */
@Controller('moderator/categories')
@Auth(Role.MODERATOR)
@SkipThrottle()
export class ModeratorCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAllForModerator();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto.name);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
