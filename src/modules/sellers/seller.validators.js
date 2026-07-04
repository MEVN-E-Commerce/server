import Joi from 'joi';

export const validateRegisterSeller = (req, res, next) => {
  const schema = Joi.object({
    storeName: Joi.string().required().trim().min(3).max(50),
    description: Joi.string().allow('').max(500),
    logo: Joi.string().allow(''),
    phone: Joi.string().allow('').max(20),
    address: Joi.string().allow('').max(200),
    payoutInfo: Joi.alternatives().try(Joi.string().allow('').max(1000), Joi.object())
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }
  next();
};

export const validateUpdateSellerProfile = (req, res, next) => {
  const schema = Joi.object({
    storeName: Joi.string().trim().min(3).max(50),
    description: Joi.string().allow('').max(500),
    logo: Joi.string().allow(''),
    phone: Joi.string().allow('').max(20),
    address: Joi.string().allow('').max(200),
    payoutInfo: Joi.alternatives().try(Joi.string().allow('').max(1000), Joi.object())
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }
  next();
};

export const validateUpdateStock = (req, res, next) => {
  const schema = Joi.object({
    stock: Joi.number().integer().min(0).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }
  next();
};

export const validateUpdateOrderStatus = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid('processing', 'shipped', 'delivered', 'cancelled').required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }
  next();
};
