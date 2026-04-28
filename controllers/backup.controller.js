const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { logger } = require('../utils');
require('dotenv').config();

class BackupController {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.ensureBackupDirectory();
    this.initializeScheduledBackups();
  }

  // Ensure backup directory exists
  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      logger.info('Backup directory created');
    }
  }

  // Get MongoDB connection details from environment
  getMongoConfig() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/movie_booking_system';
    const url = new URL(mongoUri);
    
    return {
      host: url.hostname,
      port: url.port || '27017',
      database: url.pathname.slice(1) || process.env.MONGODB_DATABASE || 'movie_booking_system',
      username: url.username || '',
      password: url.password || ''
    };
  }

  // Create database backup
  async createBackup(req, res) {
    try {
      const { description = 'Manual backup' } = req.body;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      const mongoConfig = this.getMongoConfig();
      
      // Build mongodump command with full path
      const mongodumpPath = process.platform === 'win32' 
        ? '"C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe"'
        : 'mongodump';
      
      let command = `${mongodumpPath} --host ${mongoConfig.host}:${mongoConfig.port} --db ${mongoConfig.database} --out "${backupPath}"`;
      
      if (mongoConfig.username && mongoConfig.password) {
        command += ` --username ${mongoConfig.username} --password ${mongoConfig.password}`;
      }

      logger.info(`Starting backup: ${backupName}`);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Backup failed: ${error.message}`);
          
          // Check if it's a mongodump not found error
          if (error.message.includes("'mongodump' is not recognized") || 
              error.message.includes("mongodump: command not found")) {
            return res.status(500).json({
              success: false,
              message: 'MongoDB Database Tools not installed',
              error: 'mongodump command not found. Please install MongoDB Database Tools.',
              installInstructions: {
                windows: 'Download from https://www.mongodb.com/try/download/database-tools or run: choco install mongodb-database-tools',
                checkCommand: 'npm run check:mongodump'
              }
            });
          }
          
          return res.status(500).json({
            success: false,
            message: 'Backup failed',
            error: error.message
          });
        }

        if (stderr) {
          logger.warn(`Backup warning: ${stderr}`);
        }

        // Create backup metadata
        const metadata = {
          name: backupName,
          description,
          createdAt: new Date().toISOString(),
          database: mongoConfig.database,
          size: this.getDirectorySize(backupPath),
          path: backupPath
        };

        // Save metadata
        fs.writeFileSync(
          path.join(backupPath, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        );

        logger.info(`Backup completed successfully: ${backupName}`);

        res.status(200).json({
          success: true,
          message: 'Backup created successfully',
          backup: metadata
        });
      });

    } catch (error) {
      logger.error(`Backup error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
  // Restore database from backup
  async restoreBackup(req, res) {
    try {
      const { backupName } = req.params;
      const { dropDatabase = false, targetDatabase } = req.body;
      
      const backupPath = path.join(this.backupDir, backupName);
      
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found'
        });
      }

      const mongoConfig = this.getMongoConfig();
      
      // Find the database folder in the backup
      const backupContents = fs.readdirSync(backupPath);
      const dbFolders = backupContents.filter(item => {
        const itemPath = path.join(backupPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      if (dbFolders.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid backup structure - no database folders found'
        });
      }

      // Use the target database name if provided, otherwise use the first database folder found
      const sourceDbName = dbFolders[0]; // The database name in the backup
      const targetDbName = targetDatabase || mongoConfig.database; // Where to restore it
      const dbPath = path.join(backupPath, sourceDbName);

      if (!fs.existsSync(dbPath)) {
        return res.status(400).json({
          success: false,
          message: `Invalid backup structure - database folder '${sourceDbName}' not found`
        });
      }

      // Build mongorestore command with full path
      const mongorestorePath = process.platform === 'win32' 
        ? '"C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe"'
        : 'mongorestore';
      
      let command = `${mongorestorePath} --host ${mongoConfig.host}:${mongoConfig.port} --db ${targetDbName}`;
      
      if (dropDatabase) {
        command += ' --drop';
      }
      
      if (mongoConfig.username && mongoConfig.password) {
        command += ` --username ${mongoConfig.username} --password ${mongoConfig.password}`;
      }
      
      command += ` "${dbPath}"`;

      logger.info(`Starting restore from backup: ${backupName} (${sourceDbName} -> ${targetDbName})`);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Restore failed: ${error.message}`);
          
          // Check if it's a mongorestore not found error
          if (error.message.includes("'mongorestore' is not recognized") || 
              error.message.includes("mongorestore: command not found")) {
            return res.status(500).json({
              success: false,
              message: 'MongoDB Database Tools not installed',
              error: 'mongorestore command not found. Please install MongoDB Database Tools.',
              installInstructions: {
                windows: 'Download from https://www.mongodb.com/try/download/database-tools or run: choco install mongodb-database-tools',
                checkCommand: 'npm run check:mongodump'
              }
            });
          }
          
          return res.status(500).json({
            success: false,
            message: 'Restore failed',
            error: error.message
          });
        }

        if (stderr) {
          logger.warn(`Restore warning: ${stderr}`);
        }

        logger.info(`Restore completed successfully from: ${backupName} (${sourceDbName} -> ${targetDbName})`);

        res.status(200).json({
          success: true,
          message: 'Database restored successfully',
          backup: backupName,
          sourceDatabase: sourceDbName,
          targetDatabase: targetDbName
        });
      });

    } catch (error) {
      logger.error(`Restore error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // List all available backups
  async listBackups(req, res) {
    try {
      const backups = [];
      const backupDirs = fs.readdirSync(this.backupDir);

      for (const dir of backupDirs) {
        const backupPath = path.join(this.backupDir, dir);
        const metadataPath = path.join(backupPath, 'metadata.json');

        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            backups.push(metadata);
          } catch (error) {
            logger.warn(`Failed to read metadata for backup: ${dir}`);
          }
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.status(200).json({
        success: true,
        backups,
        total: backups.length
      });

    } catch (error) {
      logger.error(`List backups error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete a backup
  async deleteBackup(req, res) {
    try {
      const { backupName } = req.params;
      const backupPath = path.join(this.backupDir, backupName);

      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found'
        });
      }

      // Remove backup directory
      fs.rmSync(backupPath, { recursive: true, force: true });

      logger.info(`Backup deleted: ${backupName}`);

      res.status(200).json({
        success: true,
        message: 'Backup deleted successfully'
      });

    } catch (error) {
      logger.error(`Delete backup error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
  // Get backup details
  async getBackupDetails(req, res) {
    try {
      const { backupName } = req.params;
      const backupPath = path.join(this.backupDir, backupName);
      const metadataPath = path.join(backupPath, 'metadata.json');

      if (!fs.existsSync(metadataPath)) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found'
        });
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      res.status(200).json({
        success: true,
        backup: metadata
      });

    } catch (error) {
      logger.error(`Get backup details error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Configure scheduled backups
  async configureSchedule(req, res) {
    try {
      const { 
        enabled = true, 
        cronExpression = '0 2 * * *', // Daily at 2 AM
        description = 'Scheduled backup',
        retentionDays = 7
      } = req.body;

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cron expression'
        });
      }

      // Save schedule configuration
      const scheduleConfig = {
        enabled,
        cronExpression,
        description,
        retentionDays,
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(this.backupDir, 'schedule.json'),
        JSON.stringify(scheduleConfig, null, 2)
      );

      // Restart scheduled backups with new configuration
      this.initializeScheduledBackups();

      logger.info(`Backup schedule updated: ${cronExpression}`);

      res.status(200).json({
        success: true,
        message: 'Backup schedule configured successfully',
        schedule: scheduleConfig
      });

    } catch (error) {
      logger.error(`Configure schedule error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get current schedule configuration
  async getSchedule(req, res) {
    try {
      const schedulePath = path.join(this.backupDir, 'schedule.json');
      
      let schedule = {
        enabled: false,
        cronExpression: '0 2 * * *',
        description: 'Scheduled backup',
        retentionDays: 7
      };

      if (fs.existsSync(schedulePath)) {
        schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
      }

      res.status(200).json({
        success: true,
        schedule
      });

    } catch (error) {
      logger.error(`Get schedule error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Initialize scheduled backups
  initializeScheduledBackups() {
    try {
      // Destroy existing scheduled task if any
      if (this.scheduledTask) {
        this.scheduledTask.destroy();
      }

      const schedulePath = path.join(this.backupDir, 'schedule.json');
      
      if (!fs.existsSync(schedulePath)) {
        logger.info('No backup schedule configuration found');
        return;
      }

      const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

      if (!schedule.enabled) {
        logger.info('Scheduled backups are disabled');
        return;
      }

      // Create scheduled task
      this.scheduledTask = cron.schedule(schedule.cronExpression, async () => {
        logger.info('Running scheduled backup...');
        
        try {
          await this.performScheduledBackup(schedule);
          await this.cleanupOldBackups(schedule.retentionDays);
        } catch (error) {
          logger.error(`Scheduled backup failed: ${error.message}`);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Phnom_Penh" // Adjust timezone as needed
      });

      logger.info(`Scheduled backups initialized: ${schedule.cronExpression}`);

    } catch (error) {
      logger.error(`Initialize scheduled backups error: ${error.message}`);
    }
  }
  // Perform scheduled backup
  async performScheduledBackup(schedule) {
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `scheduled_backup_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      const mongoConfig = this.getMongoConfig();
      
      let command = `mongodump --host ${mongoConfig.host}:${mongoConfig.port} --db ${mongoConfig.database} --out "${backupPath}"`;
      
      if (mongoConfig.username && mongoConfig.password) {
        command += ` --username ${mongoConfig.username} --password ${mongoConfig.password}`;
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Scheduled backup failed: ${error.message}`);
          reject(error);
          return;
        }

        if (stderr) {
          logger.warn(`Scheduled backup warning: ${stderr}`);
        }

        // Create backup metadata
        const metadata = {
          name: backupName,
          description: schedule.description,
          createdAt: new Date().toISOString(),
          database: mongoConfig.database,
          size: this.getDirectorySize(backupPath),
          path: backupPath,
          type: 'scheduled'
        };

        fs.writeFileSync(
          path.join(backupPath, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        );

        logger.info(`Scheduled backup completed: ${backupName}`);
        resolve(metadata);
      });
    });
  }

  // Clean up old backups based on retention policy
  async cleanupOldBackups(retentionDays) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const backupDirs = fs.readdirSync(this.backupDir);

      for (const dir of backupDirs) {
        const backupPath = path.join(this.backupDir, dir);
        const metadataPath = path.join(backupPath, 'metadata.json');

        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const backupDate = new Date(metadata.createdAt);

            if (backupDate < cutoffDate && metadata.type === 'scheduled') {
              fs.rmSync(backupPath, { recursive: true, force: true });
              logger.info(`Cleaned up old backup: ${dir}`);
            }
          } catch (error) {
            logger.warn(`Failed to process backup for cleanup: ${dir}`);
          }
        }
      }

    } catch (error) {
      logger.error(`Cleanup old backups error: ${error.message}`);
    }
  }

  // Get directory size in bytes
  getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      logger.warn(`Failed to calculate directory size: ${error.message}`);
      return 0;
    }
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get backup statistics
  async getBackupStats(req, res) {
    try {
      const backups = [];
      const backupDirs = fs.readdirSync(this.backupDir);
      let totalSize = 0;

      for (const dir of backupDirs) {
        const backupPath = path.join(this.backupDir, dir);
        const metadataPath = path.join(backupPath, 'metadata.json');

        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            backups.push(metadata);
            totalSize += metadata.size || 0;
          } catch (error) {
            logger.warn(`Failed to read metadata for backup: ${dir}`);
          }
        }
      }

      const stats = {
        totalBackups: backups.length,
        totalSize: totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        scheduledBackups: backups.filter(b => b.type === 'scheduled').length,
        manualBackups: backups.filter(b => b.type !== 'scheduled').length,
        oldestBackup: backups.length > 0 ? backups.reduce((oldest, backup) => 
          new Date(backup.createdAt) < new Date(oldest.createdAt) ? backup : oldest
        ) : null,
        newestBackup: backups.length > 0 ? backups.reduce((newest, backup) => 
          new Date(backup.createdAt) > new Date(newest.createdAt) ? backup : newest
        ) : null
      };

      res.status(200).json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error(`Get backup stats error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

// Create and export controller instance
const backupController = new BackupController();

module.exports = {
  createBackup: (req, res) => backupController.createBackup(req, res),
  restoreBackup: (req, res) => backupController.restoreBackup(req, res),
  listBackups: (req, res) => backupController.listBackups(req, res),
  deleteBackup: (req, res) => backupController.deleteBackup(req, res),
  getBackupDetails: (req, res) => backupController.getBackupDetails(req, res),
  configureSchedule: (req, res) => backupController.configureSchedule(req, res),
  getSchedule: (req, res) => backupController.getSchedule(req, res),
  getBackupStats: (req, res) => backupController.getBackupStats(req, res)
};