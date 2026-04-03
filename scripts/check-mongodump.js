const { exec } = require('child_process');
const { logger } = require('../utils');

/**
 * Check if mongodump and mongorestore are available
 */
function checkMongoTools() {
  return new Promise((resolve) => {
    // Use full path on Windows, fallback to PATH on other systems
    const mongodumpCmd = process.platform === 'win32' 
      ? '"C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe" --version'
      : 'mongodump --version';
    
    exec(mongodumpCmd, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ mongodump is not installed or not in PATH');
        console.log('\n📋 Installation Instructions:');
        console.log('1. Download MongoDB Database Tools from: https://www.mongodb.com/try/download/database-tools');
        console.log('2. Extract the archive and add the bin directory to your PATH');
        console.log('3. Alternatively, install via package manager:');
        console.log('   - Windows (Chocolatey): choco install mongodb-database-tools');
        console.log('   - macOS (Homebrew): brew install mongodb/brew/mongodb-database-tools');
        console.log('   - Ubuntu/Debian: sudo apt-get install mongodb-database-tools');
        console.log('\n⚠️  Backup and restore functionality will not work without mongodump/mongorestore');
        resolve(false);
      } else {
        console.log('✅ mongodump is available');
        console.log(`Version: ${stdout.trim()}`);
        
        // Also check mongorestore
        const mongorestoreCmd = process.platform === 'win32' 
          ? '"C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe" --version'
          : 'mongorestore --version';
        
        exec(mongorestoreCmd, (error2, stdout2) => {
          if (error2) {
            console.log('❌ mongorestore is not available');
            resolve(false);
          } else {
            console.log('✅ mongorestore is available');
            console.log(`Version: ${stdout2.trim()}`);
            resolve(true);
          }
        });
      }
    });
  });
}

// Run the check if this script is executed directly
if (require.main === module) {
  console.log('🔍 Checking MongoDB Tools availability...\n');
  checkMongoTools().then((available) => {
    if (available) {
      console.log('\n🎉 All MongoDB tools are ready for backup operations!');
    } else {
      console.log('\n❌ Please install MongoDB Database Tools to use backup functionality');
      process.exit(1);
    }
  });
}

module.exports = { checkMongoTools };