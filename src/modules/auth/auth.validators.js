//Manual validator middleware for User registration.
export const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name is required and must be at least 2 characters");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== "string" || !emailRegex.test(email)) {
    errors.push("A valid email address is required");
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    errors.push("Password is required and must be at least 8 characters");
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};

// Manual validator middleware for User login.

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== "string" || !emailRegex.test(email)) {
    errors.push("A valid email address is required");
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};

// Manual validator middleware for resending verification email.

export const validateResendVerification = (req, res, next) => {
  const { email } = req.body;
  const errors = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== "string" || !emailRegex.test(email)) {
    errors.push("A valid email address is required");
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};

/**
 * Validator for updating user profile.
 */
export const validateUpdateProfile = (req, res, next) => {
  const { name, addresses } = req.body;
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      errors.push("Name must be at least 2 characters long");
    }
  }

  if (addresses !== undefined) {
    if (!Array.isArray(addresses)) {
      errors.push("Addresses must be an array");
    }
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};

/**
 * Validator for adding an address.
 */
export const validateAddAddress = (req, res, next) => {
  const { street, city, label, postalCode, country } = req.body;
  const errors = [];

  if (!street || typeof street !== "string" || !street.trim()) {
    errors.push("Street is required");
  }

  if (!city || typeof city !== "string" || !city.trim()) {
    errors.push("City is required");
  }

  if (label !== undefined && typeof label !== "string") {
    errors.push("Label must be a string");
  }

  if (postalCode !== undefined && typeof postalCode !== "string") {
    errors.push("Postal code must be a string");
  }

  if (country !== undefined && typeof country !== "string") {
    errors.push("Country must be a string");
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};

/**
 * Validator for adding a product to wishlist (body validation).
 */
export const validateWishlistBody = (req, res, next) => {
  const { productId } = req.body;
  const errors = [];

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!productId || typeof productId !== "string" || !objectIdRegex.test(productId)) {
    errors.push("A valid Product ID (ObjectId) is required in the request body");
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};

/**
 * Validator for removing a product from wishlist (param validation).
 */
export const validateWishlistParams = (req, res, next) => {
  const { productId } = req.params;
  const errors = [];

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!productId || typeof productId !== "string" || !objectIdRegex.test(productId)) {
    errors.push("A valid Product ID (ObjectId) is required in the URL parameters");
  }

  if (errors.length > 0) {
    res.status(400);
    return next(new Error(errors.join(", ")));
  }

  next();
};
