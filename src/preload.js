const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query:          (sql, params)       => ipcRenderer.invoke('db:query', sql, params),
    run:            (sql, params)       => ipcRenderer.invoke('db:run', sql, params),
    get:            (sql, params)       => ipcRenderer.invoke('db:get', sql, params),
    all:            (sql, params)       => ipcRenderer.invoke('db:all', sql, params),
    transaction:    (operations)        => ipcRenderer.invoke('db:transaction', operations),
    hashPassword:   (plainText)         => ipcRenderer.invoke('db:hashPassword', plainText),
    verifyPassword: (plainText, hash)   => ipcRenderer.invoke('db:verifyPassword', plainText, hash),
  },
  dialog: {
    saveFile: (defaultFileName) => ipcRenderer.invoke('dialog:saveFile', defaultFileName),
  }
});
