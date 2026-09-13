const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');
const cache = require('../../utils/cache');

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

    cache.invalidateTag('categories');
    cache.invalidateTag('homepage');
    return category;
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'name or slug';
      throw new AppError(`A category with this ${field} already exists`, 400);
    }
    throw error;
  }
};

const getAllActiveCategories = async (queryParams = {}) => {
  const cacheKey = `categories:active:${queryParams.sort || queryParams.sortByPopularity || 'default'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          products: {
            where: { isActive: true },
          },
        },
      },
      products: {
        where: { isActive: true },
        select: {
          id: true,
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      },
    },
  });

  const formatted = categories.map((cat) => {
    const productCount = cat._count?.products || 0;
    const orderCount = (cat.products || []).reduce(
      (sum, p) => sum + (p._count?.orderItems || 0),
      0
    );
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      isActive: cat.isActive,
      createdAt: cat.createdAt,
      productCount,
      orderCount,
    };
  });

  if (queryParams.sortByPopularity === 'true' || queryParams.sort === 'popularity') {
    formatted.sort((a, b) => {
      if (b.productCount !== a.productCount) {
        return b.productCount - a.productCount;
      }
      if (b.orderCount !== a.orderCount) {
        return b.orderCount - a.orderCount;
      }
      return a.name.localeCompare(b.name);
    });
  } else {
    formatted.sort((a, b) => a.name.localeCompare(b.name));
  }

  cache.set(cacheKey, formatted, 60, ['categories', 'homepage']);
  return formatted;
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

    cache.invalidateTag('categories');
    cache.invalidateTag('homepage');
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
 * List all categories including active and inactive with product counts (Admin only)
 */
const getAllCategoriesForAdmin = async () => {
  return await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Permanently delete a category (Admin only)
 * Prevents foreign key constraint failure if products belong to this category
 * @param {string} id
 */
const deleteCategory = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  // Check if any products belong to this category
  const productCount = await prisma.product.count({
    where: { categoryId: id },
  });

  if (productCount > 0) {
    throw new AppError(
      `Cannot delete category "${category.name}" because it contains ${productCount} product(s). Please delete or reassign its products first, or deactivate the category.`,
      400
    );
  }

  const deleted = await prisma.category.delete({
    where: { id },
  });

  cache.invalidateTag('categories');
  cache.invalidateTag('homepage');
  return deleted;
};

/**
 * Toggle category isActive status (Admin only)
 * @param {string} id
 */
const toggleCategoryStatus = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { isActive: !category.isActive },
  });

  cache.invalidateTag('categories');
  cache.invalidateTag('homepage');
  return updated;
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

  cache.invalidateTag('categories');
  cache.invalidateTag('homepage');
  return deactivatedCategory;
};

module.exports = {
  generateSlug,
  createCategory,
  getAllActiveCategories,
  getAllCategoriesForAdmin,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  softDeleteCategory,
};

