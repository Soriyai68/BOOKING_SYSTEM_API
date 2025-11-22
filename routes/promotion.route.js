const express = require('express');
const { Role } = require('../data');
const promotionSchema = require('../schemas/promotionSchema');
const middlewares = require('../middlewares');
const PromotionController = require('../controllers/promotion.controller');
const { PERMISSIONS } = require('../middlewares/permission.middleware');

const router = express.Router();

// GET /api/v1/promotions - List promotions with pagination, search, filters
router.get(
 '/',
 middlewares.authenticate,
 middlewares.requirePermission(PERMISSIONS.PROMOTIONS_VIEW),
 middlewares.validator(promotionSchema.getAllPromotionsQuerySchema, 'query'),
 PromotionController.getAll
);

// GET /api/v1/promotions/:id - Get promotion by ID
router.get(
 '/:id',
 middlewares.authenticate,
 middlewares.requirePermission(PERMISSIONS.PROMOTIONS_VIEW),
 middlewares.validator(promotionSchema.promotionIdParamSchema, 'params'),
 PromotionController.getById
);

// POST /api/v1/promotions - Create new promotion
router.post(
 '/',
 middlewares.authenticate,
 middlewares.requirePermission(PERMISSIONS.PROMOTIONS_CREATE),
 middlewares.validator(promotionSchema.createPromotionSchema),
 PromotionController.create
);

// PUT /api/v1/promotions/:id - Update promotion
router.put(
 '/:id',
 middlewares.authenticate,
 middlewares.requirePermission(PERMISSIONS.PROMOTIONS_EDIT),
 middlewares.validator(promotionSchema.promotionIdParamSchema, 'params'),
 middlewares.validator(promotionSchema.updatePromotionSchema),
 PromotionController.update
);

// DELETE /api/v1/promotions/bulk/delete - Bulk delete promotions (hard delete)
router.delete(
 '/bulk/delete',
 middlewares.authenticate,
 middlewares.requirePermission(PERMISSIONS.PROMOTIONS_DELETE),
 middlewares.validator(promotionSchema.batchDeleteSchema),
 PromotionController.deleteBulk
);

// DELETE /api/v1/promotions/:id - Delete promotion (hard delete)
router.delete(
 '/:id',
 middlewares.authenticate,
 middlewares.requirePermission(PERMISSIONS.PROMOTIONS_DELETE),
 middlewares.validator(promotionSchema.promotionIdParamSchema, 'params'),
 PromotionController.delete
);

module.exports = router;
