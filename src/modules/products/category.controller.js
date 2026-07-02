import Category from "../../models/Category.js";
import Product from "../../models/Product.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Get all categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (err) {
    res.status(500);
    next(err);
  }
};

/**
 * Get a single category by ID
 */
export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({
      success: true,
      category,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Create a new category
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const normalizedName = name?.trim();
    const normalizedDescription = description?.trim() || "";

    if (!normalizedName) {
      const error = new Error("Category name is required");
      error.statusCode = 400;
      throw error;
    }

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, "i") },
    });
    if (existing) {
      const error = new Error("Category name already exists");
      error.statusCode = 400;
      throw error;
    }

    const category = await Category.create({
      name: normalizedName,
      description: normalizedDescription,
    });
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Update an existing category
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      throw error;
    }

    if (name !== undefined) {
      const normalizedName = name.trim();
      if (!normalizedName) {
        const error = new Error("Category name is required");
        error.statusCode = 400;
        throw error;
      }

      const existing = await Category.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        const error = new Error("Category name already exists");
        error.statusCode = 400;
        throw error;
      }
      category.name = normalizedName;
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Delete a category
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if any products are in this category
    const hasProducts = await Product.exists({ categoryId: id });
    if (hasProducts) {
      const error = new Error(
        "Cannot delete category linked to products. Please reassign or delete the products first.",
      );
      error.statusCode = 400;
      throw error;
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
