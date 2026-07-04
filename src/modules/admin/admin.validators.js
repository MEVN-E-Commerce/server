import Joi from 'joi';

// ─── Validator factory ──────────────────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map(d => d.message).join('; ');
    const err = new Error(details);
    err.statusCode = 422;
    res.status(422);
    return next(err);
  }
  req.body = value;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map(d => d.message).join('; ');
    const err = new Error(details);
    err.statusCode = 422;
    res.status(422);
    return next(err);
  }
  req.query = value;
  next();
};

// ─── User status update ────────────────────────────────────────────────────
const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean(),
  role: Joi.string().valid('customer', 'seller', 'admin'),
  sellerStatus: Joi.string().valid('pending', 'approved', 'restricted')
}).min(1).messages({
  'object.min': 'At least one field (isActive, role, or sellerStatus) is required'
});

// ─── Product status update ─────────────────────────────────────────────────
const updateProductStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});

// ─── Order shipping update ─────────────────────────────────────────────────
const updateShippingSchema = Joi.object({
  trackingNumber: Joi.string().trim().allow(''),
  courier: Joi.string().trim().allow(''),
  estimatedDelivery: Joi.date().iso().allow(null),
  deliveryDate: Joi.date().iso().allow(null),
  notes: Joi.string().trim().allow('')
}).min(1);

// ─── Banner create / update ────────────────────────────────────────────────
const createBannerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  subtitle: Joi.string().trim().max(200).allow(''),
  image: Joi.string().uri().required(),
  link: Joi.string().uri({ allowRelative: true }).allow(''),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true)
});

const updateBannerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120),
  subtitle: Joi.string().trim().max(200).allow(''),
  image: Joi.string().uri(),
  link: Joi.string().uri({ allowRelative: true }).allow(''),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.boolean()
}).min(1);

const updateBannerStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});

// ─── Exports ───────────────────────────────────────────────────────────────
export const validateUpdateUserStatus = validate(updateUserStatusSchema);
export const validateUpdateProductStatus = validate(updateProductStatusSchema);
export const validateUpdateShipping = validate(updateShippingSchema);
export const validateCreateBanner = validate(createBannerSchema);
export const validateUpdateBanner = validate(updateBannerSchema);
export const validateUpdateBannerStatus = validate(updateBannerStatusSchema);
