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
