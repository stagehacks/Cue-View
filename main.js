const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron');
const path = require('path');

const isMac = process.platform === 'darwin';
let menuObj;
let mainWindow;

const menuTemplate = require('./src/menu');

const windowMac = {
  width: 1500,
    height: 900,
    titleBarStyle: 'hiddenInset',
    transparent: true,
    frame: false,
    show: false,
    // backgroundColor: "#333333",
    vibrancy: 'window',
    visualEffectState: 'followWindow',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
}

const windowWin = {
  width: 1500,
  height: 900,
  backgroundColor: "#333333",
  webPreferences: {
    contextIsolation: false,
    nodeIntegration: true,
    preload: path.join(__dirname, 'preload.js'),
  },
}

const createWindow = () => {

  nativeTheme.themeSource = 'dark';
  
  if(isMac){
    mainWindow = new BrowserWindow(windowMac);
  }else{
    mainWindow = new BrowserWindow(windowWin);
  }

  mainWindow.loadFile('index.html');

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.defaultApp) {
    mainWindow.webContents.openDevTools();
  }

  menuObj = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menuObj);
  
};

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('enableDeviceDropdown', (event, arg) => {
  menuObj.getMenuItemById('devicePin').enabled = true;
  menuObj.getMenuItemById('deviceDelete').enabled = true;
});
ipcMain.on('disableDeviceDropdown', (event, arg) => {
  menuObj.getMenuItemById('devicePin').enabled = false;
  menuObj.getMenuItemById('deviceDelete').enabled = false;
});

ipcMain.on('enableSearchAll', (event, arg) => {
  menuObj.getMenuItemById('deviceSearch').enabled = true;
});
ipcMain.on('disableSearchAll', (event, arg) => {
  menuObj.getMenuItemById('deviceSearch').enabled = false;
});

ipcMain.on('setDevicePin', (event, arg) => {
  menuObj.getMenuItemById('devicePin').checked = arg;
});
