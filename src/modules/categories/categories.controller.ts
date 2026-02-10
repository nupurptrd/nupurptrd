import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import * as CommonTypes from '../../common/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all categories (public)' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get('root')
  @ApiOperation({ summary: 'Get root categories (public)' })
  findRootCategories() {
    return this.categoriesService.findRootCategories();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID (public)' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create category' })
  create(@Body() data: any, @Request() req: CommonTypes.AuthenticatedRequest) {
    return this.categoriesService.create(data, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.categoriesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  remove(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }

  @Post(':id/toggle-automation')
  @ApiOperation({ summary: 'Toggle category automation' })
  toggleAutomation(
    @Param('id') id: string,
    @Body() body: { isAutomated: boolean; status?: string },
  ) {
    return this.categoriesService.toggleAutomation(
      id,
      body.isAutomated,
      body.status,
    );
  }
}
