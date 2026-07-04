import * as adminService from './admin.service.js';

// ─── Dashboard ─────────────────────────────────────────────────────────────
export const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.status(200).json({ success: true, ...stats });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

// ─── Users ─────────────────────────────────────────────────────────────────
export const getUsers = async (req, res, next) => {
  try {
    const { search, role, isActive, isVerified, page, limit, sort, order } = req.query;
    const result = await adminService.listUsers({ search, role, isActive, isVerified, page, limit, sort, order });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminService.updateUserStatus(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'User updated successfully', user });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

// ─── Products ──────────────────────────────────────────────────────────────
export const getProducts = async (req, res, next) => {
  try {
    const { search, categoryId, sellerId, isActive, minPrice, maxPrice, page, limit } = req.query;
    const result = await adminService.listAdminProducts({ search, categoryId, sellerId, isActive, minPrice, maxPrice, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateProductStatus = async (req, res, next) => {
  try {
    const product = await adminService.setProductStatus(req.params.id, req.body.isActive);
    res.status(200).json({ success: true, message: 'Product status updated', product });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

// ─── Orders ────────────────────────────────────────────────────────────────
export const getOrders = async (req, res, next) => {
  try {
    const { search, status, paymentStatus, page, limit, dateFrom, dateTo } = req.query;
    const result = await adminService.listAdminOrders({ search, status, paymentStatus, page, limit, dateFrom, dateTo });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await adminService.getAdminOrderById(req.params.id);
    res.status(200).json({ success: true, order });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const order = await adminService.adminUpdateOrderStatus(req.params.id, status, note);
    res.status(200).json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateOrderShipping = async (req, res, next) => {
  try {
    const order = await adminService.updateOrderShipping(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Shipping info updated', order });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

// ─── Banners ───────────────────────────────────────────────────────────────
export const getBanners = async (req, res, next) => {
  try {
    const banners = await adminService.listBanners();
    res.status(200).json({ success: true, count: banners.length, banners });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const createBanner = async (req, res, next) => {
  try {
    const banner = await adminService.createBanner(req.body);
    res.status(201).json({ success: true, message: 'Banner created successfully', banner });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateBanner = async (req, res, next) => {
  try {
    const banner = await adminService.updateBanner(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Banner updated successfully', banner });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateBannerStatus = async (req, res, next) => {
  try {
    const banner = await adminService.setBannerStatus(req.params.id, req.body.isActive);
    res.status(200).json({ success: true, message: 'Banner status updated', banner });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    await adminService.deleteBanner(req.params.id);
    res.status(200).json({ success: true, message: 'Banner deleted (soft)' });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const uploadBannerImage = async (req, res, next) => {
  try {
    const url = await adminService.uploadBannerImage(req.file);
    res.status(200).json({ success: true, imageUrl: url });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
