import Joi from 'joi';

export const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400);
    return next(new Error(error.details.map(d => d.message).join(', ')));
  }
  next();
};

export const addToCartSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid Product ID format'
  }),
  quantity: Joi.number().integer().min(1).required()
});

export const updateQuantitySchema = Joi.object({
  quantity: Joi.number().integer().min(0).required()
});

export const mergeCartSchema = Joi.object({
  guestSessionId: Joi.string().allow('', null).optional()
});
