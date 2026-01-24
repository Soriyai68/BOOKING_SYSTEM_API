const express = require('express');
const router = express.Router();
const previewController = require('../controllers/preview.controller');
const validator = require('../middlewares/validator.middleware');
const { createPreviewSchema, updatePreviewSchema } = require('../schemas/preview.schema');

router.post('/',
 validator(createPreviewSchema),
 previewController.createPreview);
router.get('/:id',
 previewController.getPreviewById);
router.put('/:id',
 validator(updatePreviewSchema),
 previewController.updatePreview);
router.delete('/:id',
 previewController.deletePreview);

module.exports = router;
