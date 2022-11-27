const { app, BrowserWindow, Menu, ipcMain, nativeTheme, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

let menuObj;
let mainWindow;


const menuTemplate = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  {
    label: 'File',
    submenu: [
      {
        label: 'Clear Saved Data',
        id: 'resetViews',
        click (menuItem, window, event) {
          mainWindow.webContents.send('resetViews');
        }
      },
      {
        label: 'Reload App',
        role: 'reload'
      },
      { type: 'separator' },
      ...(isMac ? [{ role: 'close' }] : [{ role: 'quit' }])
    ]
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
        click (menuItem, window, event) {
          mainWindow.webContents.send('doSlots1');
        }
      },
      {
        label: 'Arrangement 2',
        accelerator: 'CommandOrControl+2',
        id: 'window2',
        enabled: true,
        click (menuItem, window, event) {
          mainWindow.webContents.send('doSlots2');
        }
      },
      {
        label: 'Arrangement 3',
        accelerator: 'CommandOrControl+3',
        id: 'window3',
        enabled: true,
        click (menuItem, window, event) {
          mainWindow.webContents.send('doSlots3');
        }
      },
      { type: 'separator' },
      { role: 'toggleDevTools' }
    ]
  },
  {
    label: 'Device',
    submenu: [
      {
        label: 'Search for Devices',
        accelerator: 'CommandOrControl+F',
        id: 'deviceSearch',
        enabled: true,
        click (menuItem, window, event) {
          mainWindow.webContents.send('doSearch');
        }
      },
      { type: 'separator' },
      {
        label: 'Pinned',
        type: 'checkbox',
        checked: true,
        accelerator: 'CommandOrControl+P',
        id: 'devicePin',
        enabled: false,
        click (menuItem, window, event) {
          mainWindow.webContents.send(
            'setActiveDevicePinned',
            menuItem.checked
          );
        }
      },
      {
        label: 'Delete',
        accelerator: 'CommandOrControl+Backspace',
        id: 'deviceDelete',
        enabled: false,
        click (menuItem, window, event) {
          mainWindow.webContents.send('doDelete');
        }
      }
    ]
  },
  {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'About',
        role: 'about'
      },
      {
        label: 'Check for Updates',
        click: ()=>{
          autoUpdater.checkForUpdates();
        }
      }
    ]
  },
];


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

if (isWin)
{
    app.setAppUserModelId(app.name);
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


// Autoupdate logic

// this can be set to true to bypass the download update dialog and skip straight to install prompt
autoUpdater.autoDownload = false;

autoUpdater.on('update-available', (updateInfo)=>{

  // skip prompting to download if autoDownload is set
  if(autoUpdater.autoDownload){
    return;
  }

  const msg = `Version ${updateInfo.version} is available:  Would you like to download?`
  const title = 'Update Available';

  let dialogOpts = {}

  if(isMac){
    dialogOpts = {
      type: 'info',
      buttons: ['Download', 'Cancel'],
      title: 'Update Available',
      message: title,
      detail: `Auto updating is not yet automatic on MacOS. Please manually download and install version ${updateInfo.version}.`
    }
  }else{
    dialogOpts = {
      type: 'info',
      buttons: ['Download', 'Cancel'],
      title: 'Update Available',
      message: msg
    }
  }
  
  dialog.showMessageBox(mainWindow,dialogOpts).then((returnValue) => {
    // download was clicked
    if (returnValue.response === 0){ 
      if(!isMac){
        autoUpdater.downloadUpdate();
      }else{
        // TODO: get code signing working
        // temp solution to direct user to download
        shell.openExternal("https://github.com/stagehacks/Cue-View/releases/")
      }

    }
  })
})

autoUpdater.on('update-downloaded',(event)=>{
  const title = 'Update Downloaded';
  const msg = `Version ${event.version} has been downloaded. Would you like to install this update now?`

  let dialogOpts = {}
  
  if(isMac){
    dialogOpts = {
      type: 'info',
      buttons: ['Install', 'Later'],
      title: 'Update Available',
      message: title,
      detail: msg
    }
  }else{
    dialogOpts = {
      type: 'info',
      buttons: ['Install', 'Later'],
      title: 'Update Available',
      message: msg
    }
  }
  
  dialog.showMessageBox(mainWindow,dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall()
  })
})

autoUpdater.on('update-not-available',(updateInfo)=>{
  let dialogOpts = {}
  const msg = `There is no update available at this time. Latest version is v${updateInfo.version}`
  if(isMac){
    dialogOpts = {
      type: 'info',
      buttons: ['Ok'],
      title: 'No Update Available',
      message: 'No Update Available',
      detail: msg
    }
  }else{
    dialogOpts = {
      type: 'info',
      buttons: ['Ok'],
      title: 'No Update Available',
      message: msg
    }
  }

  dialog.showMessageBox(mainWindow,dialogOpts)
})

autoUpdater.on('error',(error,message)=>{
  let dialogOpts = {}
  
  if(isMac){
    dialogOpts = {
      type: 'error',
      buttons: ['Ok'],
      title: 'Update Error',
      message: 'Update Error',
      detail: error.message
    }
  }else{
    dialogOpts = {
      type: 'error',
      buttons: ['Ok'],
      title: 'Update Error',
      message: error.message
    }
  }

  dialog.showMessageBox(mainWindow,dialogOpts)
})
