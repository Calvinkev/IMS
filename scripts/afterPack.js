const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
  // Only for Windows builds
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  console.log('AfterPack: Setting up sqlite3 for Windows...');

  const appPath = context.appOutDir;
  const resourcesPath = path.join(appPath, 'resources', 'app');
  const nodeModulesPath = path.join(resourcesPath, 'node_modules');
  const sqlite3Path = path.join(nodeModulesPath, 'sqlite3');
  
  const winBinaryPath = path.join(__dirname, '..', 'native-binaries', 'win', 'build', 'Release', 'node_sqlite3.node');
  
  if (!fs.existsSync(winBinaryPath)) {
    console.log('Warning: Windows sqlite3 binary not found at:', winBinaryPath);
    return;
  }

  // Ensure sqlite3 directory exists in app's node_modules
  if (!fs.existsSync(sqlite3Path)) {
    console.log('Creating sqlite3 module directory...');
    fs.mkdirSync(sqlite3Path, { recursive: true });
    fs.mkdirSync(path.join(sqlite3Path, 'lib'), { recursive: true });
    
    // Copy essential files from source node_modules
    const sourceSqlite3 = path.join(__dirname, '..', 'node_modules', 'sqlite3');
    if (fs.existsSync(sourceSqlite3)) {
      // Copy package.json and lib files
      fs.copyFileSync(
        path.join(sourceSqlite3, 'package.json'),
        path.join(sqlite3Path, 'package.json')
      );
      
      // Copy lib directory contents
      const libSource = path.join(sourceSqlite3, 'lib');
      if (fs.existsSync(libSource)) {
        const libFiles = fs.readdirSync(libSource);
        for (const file of libFiles) {
          fs.copyFileSync(
            path.join(libSource, file),
            path.join(sqlite3Path, 'lib', file)
          );
        }
      }
    }
  }

  // Create build/Release directory and copy Windows binary
  const buildReleasePath = path.join(sqlite3Path, 'build', 'Release');
  fs.mkdirSync(buildReleasePath, { recursive: true });
  
  const destBinary = path.join(buildReleasePath, 'node_sqlite3.node');
  fs.copyFileSync(winBinaryPath, destBinary);
  console.log('Copied Windows sqlite3 binary to:', destBinary);

  // Also try to find and replace any existing binaries
  const findFiles = (dir, pattern) => {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...findFiles(fullPath, pattern));
      } else if (file === pattern) {
        results.push(fullPath);
      }
    }
    return results;
  };

  const existingBinaries = findFiles(appPath, 'node_sqlite3.node');
  for (const binaryPath of existingBinaries) {
    if (binaryPath !== destBinary) {
      console.log('Replacing existing binary:', binaryPath);
      fs.copyFileSync(winBinaryPath, binaryPath);
    }
  }

  console.log('Successfully configured sqlite3 for Windows');
};
