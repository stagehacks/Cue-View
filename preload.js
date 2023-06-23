const { ipcRenderer } = require('electron');

const DEVICE = require('./src/device.js');
const PLUGINS = require('./src/plugins.js');
const SEARCH = require('./src/search.js');
const VIEW = require('./src/view.js');
const SAVESLOTS = require('./src/saveSlots.js');

window.addDevice = DEVICE.addDevice;
window.searchAll = SEARCH.searchAll;

window.init = function init() {
  console.log('init!');

  ipcRenderer.send('enableDeviceDropdown');
  ipcRenderer.send('enableSearchAll');

  // load autoUpdate setting from storage and send to main process
  const autoUpdate = JSON.parse(localStorage.getItem('autoUpdate'));
  if (autoUpdate !== undefined && autoUpdate !== null) {
    if (autoUpdate) {
      ipcRenderer.send('checkForUpdates');
    }
    // send message so main process knows the state of autoUpdate
    ipcRenderer.send('setAutoUpdate', autoUpdate);
  }

  PLUGINS.init(() => {
    VIEW.init();
    SAVESLOTS.loadDevices();
    SAVESLOTS.loadSlot(1);
  });

  document.getElementById('search-button').onclick = (e) => {
    SEARCH.searchAll();
  };

  document.getElementById('device-settings-table').onclick = function settingsClick(e) {
    e.stopPropagation();
  };

  document.getElementById('device-settings-name').onchange = function nameChange(e) {
    e.stopPropagation();
    DEVICE.changeActiveName(e.target.value);
  };

  document.getElementById('device-settings-plugin-dropdown').onchange = function dropdownChange(e) {
    e.stopPropagation();
    DEVICE.changeActiveType(e.target.value);
  };

  document.getElementById('device-settings-ip').onchange = function ipChange(e) {
    e.stopPropagation();
    DEVICE.changeActiveIP(e.target.value);
  };

  document.getElementById('device-settings-port').onchange = function portChange(e) {
    e.stopPropagation();
    DEVICE.changeActivePort(e.target.value);
  };

  document.getElementById('device-settings-rx-port').onchange = function portChange(e) {
    e.stopPropagation();
    DEVICE.changeActiveRxPort(e.target.value);
  };

  document.getElementById('device-settings-pin').onchange = function pinChange(e) {
    e.stopPropagation();
    if (e.target.checked) {
      VIEW.pinActiveDevice();
    } else {
      VIEW.unpinActiveDevice();
    }
  };

  const saveSlots = document.getElementsByClassName('save-slot');

  for (let i = 0; i < saveSlots.length; i++) {
    const saveSlot = saveSlots[i];
    saveSlot.addEventListener('click', (event) => {
      // get save slot from button id save-slot-1 = 1
      const saveSlotIndex = parseInt(event.target.id.replace('save-slot-', ''), 10);
      if (saveSlotIndex) {
        SAVESLOTS.loadSlot(saveSlotIndex);
      }
    });
  }

  document.getElementById('refresh-device-button').onclick = function refreshClick(e) {
    e.stopPropagation();
    DEVICE.refreshActive();
  };

  document.getElementById('device-list').onclick = function listClick(e) {
    e.stopPropagation();
    const deviceID = e.srcElement.id;
    if (e.srcElement.id !== 'device-list') {
      VIEW.switchDevice(deviceID);
    } else {
      VIEW.switchDevice(undefined);
    }
  };

  document.getElementById('add-device-button').onchange = function addDeviceClick(e) {
    const newDevice = DEVICE.registerDevice(
      {
        type: e.target.value,
        defaultName: 'New Device',
        remotePort: PLUGINS.all[e.target.value].config.remotePort || '',
        addresses: [],
      },
      'fromAddButton'
    );
    e.target.selectedIndex = 0;

    VIEW.switchDevice(newDevice.id);
    SAVESLOTS.saveAll();
  };

  document.getElementById('network-info-button').onclick = function fooBar(e) {
    ipcRenderer.send('openNetworkInfoWindow');
  };

  document.onkeyup = function keyUp(e) {
    if (e.key === 'ArrowUp') {
      VIEW.selectPreviousDevice();
    } else if (e.key === 'ArrowDown') {
      VIEW.selectNextDevice();
    } else if (e.key === 'Tab') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
        document.getElementById('device-settings-name').select();
      }
    }
  };
};

ipcRenderer.on('setActiveDevicePinned', (event, message) => {
  if (!message) {
    VIEW.unpinActiveDevice();
  } else {
    VIEW.pinActiveDevice();
  }
});

ipcRenderer.on('searchAll', (event, message) => {
  window.searchAll();
});

ipcRenderer.on('deleteActive', (event, message) => {
  DEVICE.deleteActive();
  VIEW.selectPreviousDevice();
});

ipcRenderer.on('clearSavedData', (event, message) => {
  SAVESLOTS.clearSavedData();
});

ipcRenderer.on('loadSlot', (event, slot) => {
  if (slot) {
    SAVESLOTS.loadSlot(slot);
  }
});

// message from main process to set autoUpdate state
ipcRenderer.on('setAutoUpdate', (event, autoUpdate) => {
  localStorage.setItem('autoUpdate', autoUpdate);
  if (autoUpdate) {
    ipcRenderer.send('checkForUpdates');
  }
  // message to main process that we have updated the state
  ipcRenderer.send('setAutoUpdate', autoUpdate);
});

function switchClass(element, className) {
  try {
    document.getElementsByClassName(className)[0].classList.remove(className);
  } catch (err) {
    // console.log(err)
  }
  element.classList.add(className);
}
window.switchClass = switchClass;
