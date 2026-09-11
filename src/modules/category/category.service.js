const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

/**
 * Generate URL-friendly slug from category name
 * e.g., "Handmade Crafts" -> "handmade-crafts"
 * @param {string} name
 * @returns {string}
 */
const generateSlug = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric except space & hyphen
    .replace(/[\s_-]+/g, '-')       // replace spaces & underscores with single hyphen
    .replace(/^-+|-+$/g, '');       // trim leading and trailing hyphens
};

/**
 * Create a new category (Admin only)
 * @param {Object} data - { name, description, imageUrl, isActive }
 */
const createCategory = async ({ name, description, imageUrl, isActive = true }) => {
  if (!name || !name.trim()) {
    throw new AppError('Category name is required', 400);
  }

  const trimmedName = name.trim();
  const slug = generateSlug(trimmedName);

  if (!slug) {
    throw new AppError('Category name must contain valid alphanumeric characters for slug generation', 400);
  }

  // Check if category with existing name or slug already exists
  const existingCategory = await prisma.category.findFirst({
    where: {
      OR: [
        { name: { equals: trimmedName, mode: 'insensitive' } },
        { slug },
      ],
    },
  });

  if (existingCategory) {
    if (existingCategory.name.toLowerCase() === trimmedName.toLowerCase()) {
      throw new AppError(`A category with the name "${trimmedName}" already exists`, 400);
    }
    throw new AppError(`A category with the slug "${slug}" already exists`, 400);
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        slug,
        description: description ? description.trim() : null,
        imageUrl: imageUrl ? imageUrl.trim() : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    return category;
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'name or slug';
      throw new AppError(`A category with this ${field} already exists`, 400);
    }
    throw error;
  }
};

/**
 * List all active categories (Public)
 */
const getAllActiveCategories = async () => {
  return await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
};

/**
 * Get single active category by slug (Public)
 * @param {string} slug
 */
const getCategoryBySlug = async (slug) => {
  if (!slug || !slug.trim()) {
    throw new AppError('Category slug is required', 400);
  }

  const category = await prisma.category.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  });

  if (!category || !category.isActive) {
    throw new AppError('Category not found', 404);
  }

  return category;
};

/**
 * Update category details by ID (Admin only)
 * Auto-generates new slug if name is updated
 * @param {string} id
 * @param {Object} updateData - { name, description, imageUrl, isActive }
 */
const updateCategory = async (id, updateData) => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const dataToUpdate = {};

  if (updateData.name !== undefined) {
    if (!updateData.name || !updateData.name.trim()) {
      throw new AppError('Category name cannot be empty', 400);
    }

    const trimmedName = updateData.name.trim();

    // If the name changed, regenerate slug and check uniqueness
    if (trimmedName.toLowerCase() !== category.name.toLowerCase()) {
      const newSlug = generateSlug(trimmedName);

      if (!newSlug) {
        throw new AppError('Category name must contain valid alphanumeric characters for slug generation', 400);
      }

      const existingCategory = await prisma.category.findFirst({
        where: {
          id: { not: id },
          OR: [
            { name: { equals: trimmedName, mode: 'insensitive' } },
            { slug: newSlug },
          ],
        },
      });

      if (existingCategory) {
        if (existingCategory.name.toLowerCase() === trimmedName.toLowerCase()) {
          throw new AppError(`A category with the name "${trimmedName}" already exists`, 400);
        }
        throw new AppError(`A category with the slug "${newSlug}" already exists`, 400);
      }

      dataToUpdate.name = trimmedName;
      dataToUpdate.slug = newSlug;
    } else if (trimmedName !== category.name) {
      // Just case difference in display name
      dataToUpdate.name = trimmedName;
    }
  }

  if (updateData.description !== undefined) {
    dataToUpdate.description = updateData.description ? updateData.description.trim() : null;
  }

  if (updateData.imageUrl !== undefined) {
    dataToUpdate.imageUrl = updateData.imageUrl ? updateData.imageUrl.trim() : null;
  }

  if (updateData.isActive !== undefined) {
    dataToUpdate.isActive = Boolean(updateData.isActive);
  }

  try {
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: dataToUpdate,
    });

    return updatedCategory;
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'name or slug';
      throw new AppError(`A category with this ${field} already exists`, 400);
    }
    throw error;
  }
};

/**
 * Soft delete category by setting isActive: false (Admin only)
 * @param {string} id
 */
const softDeleteCategory = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const deactivatedCategory = await prisma.category.update({
    where: { id },
    data: { isActive: false },
  });

  return deactivatedCategory;
};

module.exports = {
  generateSlug,
  createCategory,
  getAllActiveCategories,
  getCategoryBySlug,
  updateCategory,
  softDeleteCategory,
};
