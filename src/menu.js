const isMac = process.platform === 'darwin';
//isMac && { role: 'appMenu' },
//isMac ? { role: 'close' } : { role: 'quit' }
module.exports = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  {
    label: 'File',
    submenu: [
      {
        label: 'Clear Saved Data',
        id: 'resetViews',
        click: function (menuItem, window, event) {
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
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doSlots1');
        }
      },
      {
        label: 'Arrangement 2',
        accelerator: 'CommandOrControl+2',
        id: 'window2',
        enabled: true,
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doSlots2');
        }
      },
      {
        label: 'Arrangement 3',
        accelerator: 'CommandOrControl+3',
        id: 'window3',
        enabled: true,
        click: function (menuItem, window, event) {
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
        click: function (menuItem, window, event) {
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
        click: function (menuItem, window, event) {
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
        click: function (menuItem, window, event) {
          mainWindow.webContents.send('doDelete');
        }
      }
    ]
  }
];