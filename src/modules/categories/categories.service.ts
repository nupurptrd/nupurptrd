import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Category } from '../../entities/category.entity';

// Transform category to snake_case for frontend compatibility
function transformCategory(category: Category): any {
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    icon: category.icon,
    parent_id: category.parentId,
    languages: category.languages || [],
    preferred_voices: category.preferredVoices,
    is_automated: category.isAutomated,
    automation_status: category.automationStatus,
    is_active: category.isActive,
    sort_order: category.sortOrder,
    last_generated_at: category.lastGeneratedAt,
    created_by: category.createdBy,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
    children: category.children?.map(transformCategory) || [],
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAll() {
    const categories = await this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
      relations: ['children'],
    });
    return categories.map(transformCategory);
  }

  async findRootCategories() {
    const categories = await this.categoryRepository.find({
      where: { parentId: IsNull() },
      order: { sortOrder: 'ASC', name: 'ASC' },
      relations: ['children'],
    });
    return categories.map(transformCategory);
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'articles'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findOneTransformed(id: string) {
    const category = await this.findOne(id);
    return transformCategory(category);
  }

  async create(data: any, userId?: string) {
    // Transform snake_case input to camelCase for entity
    const category = this.categoryRepository.create({
      name: data.name,
      description: data.description,
      icon: data.icon,
      parentId: data.parent_id,
      languages: data.languages || [],
      preferredVoices: data.preferred_voices,
      isAutomated: data.is_automated,
      automationStatus: data.automation_status,
      isActive: data.is_active !== false,
      sortOrder: data.sort_order || 0,
      createdBy: userId,
    });
    const saved = await this.categoryRepository.save(category);
    return transformCategory(saved);
  }

  async update(id: string, data: any) {
    const category = await this.findOne(id);
    // Transform snake_case input to camelCase for entity
    if (data.name !== undefined) category.name = data.name;
    if (data.description !== undefined) category.description = data.description;
    if (data.icon !== undefined) category.icon = data.icon;
    if (data.parent_id !== undefined) category.parentId = data.parent_id;
    if (data.languages !== undefined) category.languages = data.languages;
    if (data.preferred_voices !== undefined)
      category.preferredVoices = data.preferred_voices;
    if (data.is_automated !== undefined)
      category.isAutomated = data.is_automated;
    if (data.automation_status !== undefined)
      category.automationStatus = data.automation_status;
    if (data.is_active !== undefined) category.isActive = data.is_active;
    if (data.sort_order !== undefined) category.sortOrder = data.sort_order;
    const saved = await this.categoryRepository.save(category);
    return transformCategory(saved);
  }

  async delete(id: string) {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    return { success: true };
  }

  async toggleAutomation(id: string, isAutomated: boolean, status?: string) {
    const category = await this.findOne(id);
    category.isAutomated = isAutomated;
    category.automationStatus = status || (isAutomated ? 'running' : 'stopped');
    const saved = await this.categoryRepository.save(category);
    return transformCategory(saved);
  }

  async getAutomatedCategories() {
    return this.categoryRepository.find({
      where: {
        isAutomated: true,
        automationStatus: 'running',
        isActive: true,
      },
    });
  }
}
