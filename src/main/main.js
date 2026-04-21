const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('./database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    },
    show: false
  });

  const forceLocalBuild = process.env.IMS_FORCE_LOCAL_BUILD === '1';
  const isDev = !app.isPackaged && !forceLocalBuild;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  db = new Database();
  db.init();
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('db:query', async (event, sql, params) => {
  return db.query(sql, params);
});

ipcMain.handle('db:run', async (event, sql, params) => {
  return db.run(sql, params);
});

ipcMain.handle('db:get', async (event, sql, params) => {
  return db.get(sql, params);
});

ipcMain.handle('db:all', async (event, sql, params) => {
  return db.all(sql, params);
});
