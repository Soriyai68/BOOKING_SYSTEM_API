const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermission, PERMISSIONS } = require('../middlewares/permission.middleware');
const validateMiddleware = require('../middlewares/validator.middleware');
const { 
  createBackupSchema, 
  restoreBackupSchema, 
  scheduleConfigSchema, 
  backupNameSchema 
} = require('../schemas/backupSchema');

// All backup routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/backups
 * @desc    Create a new database backup
 * @access  Requires backups.create permission
 * @body    { description?: string }
 */
router.post('/', 
  requirePermission(PERMISSIONS.BACKUPS_CREATE),
  validateMiddleware(createBackupSchema), 
  backupController.createBackup
);

/**
 * @route   GET /api/backups
 * @desc    List all available backups
 * @access  Requires backups.view permission
 */
router.get('/', 
  requirePermission(PERMISSIONS.BACKUPS_VIEW),
  backupController.listBackups
);

/**
 * @route   GET /api/backups/stats
 * @desc    Get backup statistics
 * @access  Requires backups.stats permission
 */
router.get('/stats', 
  requirePermission(PERMISSIONS.BACKUPS_STATS),
  backupController.getBackupStats
);

/**
 * @route   GET /api/backups/schedule
 * @desc    Get current backup schedule configuration
 * @access  Requires backups.view permission
 */
router.get('/schedule', 
  requirePermission(PERMISSIONS.BACKUPS_VIEW),
  backupController.getSchedule
);

/**
 * @route   POST /api/backups/schedule
 * @desc    Configure backup schedule
 * @access  Requires backups.schedule permission
 * @body    { enabled: boolean, cronExpression: string, description?: string, retentionDays?: number }
 */
router.post('/schedule', 
  requirePermission(PERMISSIONS.BACKUPS_SCHEDULE),
  validateMiddleware(scheduleConfigSchema), 
  backupController.configureSchedule
);

/**
 * @route   GET /api/backups/:backupName
 * @desc    Get backup details
 * @access  Requires backups.view permission
 */
router.get('/:backupName', 
  requirePermission(PERMISSIONS.BACKUPS_VIEW),
  validateMiddleware(backupNameSchema, 'params'), 
  backupController.getBackupDetails
);

/**
 * @route   POST /api/backups/:backupName/restore
 * @desc    Restore database from backup
 * @access  Requires backups.restore permission
 * @body    { dropDatabase?: boolean }
 */
router.post('/:backupName/restore', 
  requirePermission(PERMISSIONS.BACKUPS_RESTORE),
  validateMiddleware(backupNameSchema, 'params'),
  validateMiddleware(restoreBackupSchema),
  backupController.restoreBackup
);

/**
 * @route   DELETE /api/backups/:backupName
 * @desc    Delete a backup
 * @access  Requires backups.delete permission
 */
router.delete('/:backupName', 
  requirePermission(PERMISSIONS.BACKUPS_DELETE),
  validateMiddleware(backupNameSchema, 'params'), 
  backupController.deleteBackup
);

module.exports = router;