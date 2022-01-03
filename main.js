const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

if (require('electron-squirrel-startup')) {
  app.quit();
}

var menu;
let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
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
      // enableRemoteModule: true,
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.defaultApp) {
    mainWindow.webContents.openDevTools();
  }

  menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
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

const { ipcMain } = require('electron');
ipcMain.on('enableDeviceDropdown', (event, arg) => {
  menu.getMenuItemById('devicePin').enabled = true;
  menu.getMenuItemById('deviceDelete').enabled = true;
});
ipcMain.on('disableDeviceDropdown', (event, arg) => {
  menu.getMenuItemById('devicePin').enabled = false;
  menu.getMenuItemById('deviceDelete').enabled = false;
});

ipcMain.on('enableSearchAll', (event, arg) => {
  menu.getMenuItemById('deviceSearch').enabled = true;
});
ipcMain.on('disableSearchAll', (event, arg) => {
  menu.getMenuItemById('deviceSearch').enabled = false;
});

ipcMain.on('setDevicePin', (event, arg) => {
  menu.getMenuItemById('devicePin').checked = arg;
});

const isMac = process.platform === 'darwin';

const menuTemplate = [
  { role: 'appMenu' },
  {
    label: 'File',
    submenu: [
      {
        label: 'Clear Saved Data',
        id: 'resetViews',
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('resetViews');
        },
      },
      {
        label: 'Reload App',
        role: 'reload',
      },
      {
        type: 'separator',
      },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      { role: 'togglefullscreen' },
      { type: 'separator' },
      {
        label: 'Arrangement 1',
        accelerator: 'CommandOrControl+1',
        id: 'window1',
        enabled: true,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doSlots1');
        },
      },
      {
        label: 'Arrangement 2',
        accelerator: 'CommandOrControl+2',
        id: 'window2',
        enabled: true,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doSlots2');
        },
      },
      {
        label: 'Arrangement 3',
        accelerator: 'CommandOrControl+3',
        id: 'window3',
        enabled: true,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doSlots3');
        },
      },
      { type: 'separator' },
      { role: 'toggleDevTools' },
    ],
  },
  {
    label: 'Device',
    submenu: [
      {
        label: 'Search for Devices',
        accelerator: 'CommandOrControl+F',
        id: 'deviceSearch',
        enabled: true,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doSearch');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Pinned',
        type: 'checkbox',
        checked: true,
        accelerator: 'CommandOrControl+P',
        id: 'devicePin',
        enabled: false,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send(
            'setActiveDevicePinned',
            menuItem.checked
          );
        },
      },
      {
        label: 'Delete',
        accelerator: 'CommandOrControl+Backspace',
        id: 'deviceDelete',
        enabled: false,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doDelete');
        },
      },
    ],
  },
];
