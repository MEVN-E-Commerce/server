import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import { uploadImage } from "../../utils/cloudinary.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Get all products with search and filtering
 */
export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      sellerId,
      isActive,
      minRating,
    } = req.query;
    const query = {};

    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      query.$or = [
        { name: { $regex: escapeRegex(normalizedSearch), $options: "i" } },
        {
          description: { $regex: escapeRegex(normalizedSearch), $options: "i" },
        },
      ];
    }

    // 2. Filter by category
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // 3. Filter by seller
    if (sellerId) {
      query.sellerId = sellerId;
    }

    // 4. Filter by price range
    if (
      (minPrice !== undefined && minPrice !== "") ||
      (maxPrice !== undefined && maxPrice !== "")
    ) {
      query.price = {};
      if (minPrice !== undefined && minPrice !== "") {
        const minVal = parseFloat(minPrice);
        if (!isNaN(minVal)) query.price.$gte = minVal;
      }
      if (maxPrice !== undefined && maxPrice !== "") {
        const maxVal = parseFloat(maxPrice);
        if (!isNaN(maxVal)) query.price.$lte = maxVal;
      }
    }

    // 5. Filter by rating
    if (minRating !== undefined && minRating !== "") {
      const ratingVal = parseFloat(minRating);
      if (!isNaN(ratingVal)) {
        query.rating = { $gte: ratingVal };
      }
    }

    // 6. Filter by active status
    if (isActive === "false") {
      query.isActive = false;
    } else if (isActive === "all") {
      // Return both active and inactive
    } else if (isActive === "true") {
      query.isActive = true;
    } else {
      // Default behavior: return only active products for normal customers
      query.isActive = true;
    }

    // Executing the query, populate category and seller details (except password hashes)
    const products = await Product.find(query)
      .populate("categoryId", "name description")
      .populate("sellerId", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    res.status(500);
    next(err);
  }
};

/**
 * Get a single product by ID
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate("categoryId", "name description")
      .populate("sellerId", "name email role");

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Create a new product
 */
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      categoryId,
      images,
      stock,
      isActive,
      sellerId,
      rating,
    } = req.body;

    // Validate required fields
    if (!name || price === undefined || !categoryId) {
      const error = new Error(
        "Name, price, and categoryId are required fields",
      );
      error.statusCode = 400;
      throw error;
    }

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 400;
      throw error;
    }

    // Determine sellerId: admins can assign to any seller, sellers are restricted to themselves
    let productSellerId = req.user.userId;
    if (req.user.role === "admin" && sellerId) {
      productSellerId = sellerId;
    }

    const product = await Product.create({
      sellerId: productSellerId,
      name,
      description: description || "",
      price: parseFloat(price),
      categoryId,
      images: images || [],
      stock: stock !== undefined ? parseInt(stock, 10) : 0,
      isActive: isActive !== undefined ? !!isActive : true,
      rating: rating !== undefined ? parseFloat(rating) : 0,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Update an existing product
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      categoryId,
      images,
      stock,
      isActive,
      sellerId,
      rating,
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    // RBAC: Verify if requester is authorized (admin OR the product owner)
    if (
      req.user.role !== "admin" &&
      product.sellerId.toString() !== req.user.userId
    ) {
      const error = new Error("Forbidden — you do not own this product");
      error.statusCode = 403;
      throw error;
    }

    // Validate category check if changed
    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        const error = new Error("Category not found");
        error.statusCode = 400;
        throw error;
      }
      product.categoryId = categoryId;
    }

    // Update fields
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (images !== undefined) product.images = images;
    if (stock !== undefined) product.stock = parseInt(stock, 10);
    if (isActive !== undefined) product.isActive = !!isActive;
    if (rating !== undefined) product.rating = parseFloat(rating);

    // Admin can update sellerId
    if (req.user.role === "admin" && sellerId) {
      product.sellerId = sellerId;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Delete a product
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    // RBAC: Verify if requester is authorized (admin OR the product owner)
    if (
      req.user.role !== "admin" &&
      product.sellerId.toString() !== req.user.userId
    ) {
      const error = new Error("Forbidden — you do not own this product");
      error.statusCode = 403;
      throw error;
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Upload route handler for photos / files
 */
export const uploadImagesHandler = async (req, res, next) => {
  try {
    if (req.file) {
      const url = await uploadImage(req.file.buffer, req.file.originalname);
      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        imageUrl: url,
        imageUrls: [url],
      });
    }

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) =>
        uploadImage(file.buffer, file.originalname),
      );
      const urls = await Promise.all(uploadPromises);
      return res.status(200).json({
        success: true,
        message: "Images uploaded successfully",
        imageUrls: urls,
      });
    }

    const error = new Error("No files uploaded");
    error.statusCode = 400;
    throw error;
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
