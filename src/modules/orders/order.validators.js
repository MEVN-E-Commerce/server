import Joi from 'joi';

export const placeOrderSchema = Joi.object({
  shippingAddress: Joi.object({
    fullName: Joi.string().required(),
    line1: Joi.string().required(),
    line2: Joi.string().allow('', null).optional(),
    city: Joi.string().required(),
    country: Joi.string().required(),
    postalCode: Joi.string().required(),
    phone: Joi.string().required()
  }).required(),
  contactEmail: Joi.string().email().optional()
});

export const validatePlaceOrder = (req, res, next) => {
  const isGuest = !req.user;
  const { error } = placeOrderSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400);
    return next(new Error(error.details.map(d => d.message).join(', ')));
  }

  // Enforce contactEmail for guests
  if (isGuest && !req.body.contactEmail) {
    res.status(400);
    return next(new Error('contactEmail is required for guest checkout'));
  }

  next();
};

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled').required(),
  note: Joi.string().allow('', null).optional()
});

export const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400);
    return next(new Error(error.details.map(d => d.message).join(', ')));
  }
  next();
};
