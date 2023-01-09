const VIEW = require('./view.js');
const DEVICE = require('./device.js');

let activeSlot = false;
let savedSlots = [[], [], [], []];
let savedDevices = [];

const storedSlots = localStorage.getItem('savedSlots');
if (storedSlots) {
  savedSlots = JSON.parse(storedSlots);
  // can probably be removed but I've noticed some older versions left some [null] slots in the savedSlots
  savedSlots = savedSlots.map((savedSlot) => {
    if (savedSlot.length === 1 && savedSlot[0] === null) {
      return [];
    }
    return savedSlot;
  });
}

const storedDevices = localStorage.getItem('savedDevices');
if (storedDevices) {
  savedDevices = JSON.parse(storedDevices);
}

function loadSlot(slotIndex) {
  VIEW.toggleSlotButtons(slotIndex);
  activeSlot = slotIndex;

  Object.keys(DEVICE.all).forEach((d) => {
    DEVICE.changePinIndex(DEVICE.all[d], false);
  });
  VIEW.resetPinned();

  Object.keys(savedSlots[slotIndex]).forEach((slot) => {
    const savedDevice = savedSlots[slotIndex][slot];

    Object.keys(DEVICE.all).forEach((d) => {
      const device = DEVICE.all[d];

      if (device.id === savedDevice.id) {
        VIEW.pinDevice(device);
        VIEW.switchDevice(device.id);
      } else if (
        device.addresses[0] === savedDevice.addresses[0] &&
        device.type === savedDevice.type &&
        savedDevice.addresses[0] !== undefined
      ) {
        VIEW.pinDevice(device);
        VIEW.switchDevice(device.id);
      }
    });
  });
}
module.exports.loadSlot = loadSlot;

module.exports.loadDevices = function loadDevices() {
  console.log(`Loading ${savedDevices.length} saved devices...`);

  for (let i = 0; i < savedDevices.length; i++) {
    DEVICE.registerDevice(
      {
        type: savedDevices[i].type,
        displayName: savedDevices[i].displayName,
        defaultName: savedDevices[i].defaultName,
        port: savedDevices[i].port,
        addresses: savedDevices[i].addresses,
        id: savedDevices[i].id,
        fields: savedDevices[i].fields,
      },
      'fromSave'
    );
  }
};

module.exports.saveAll = function saveAll() {
  console.log('Saving...');
  const currentPins = VIEW.getPinnedDevices();

  savedSlots[activeSlot] = [];
  for (let i = 0; i < currentPins.length; i++) {
    if (currentPins[i]) {
      // only include saved devices
      if (currentPins[i].id in DEVICE.all) {
        savedSlots[activeSlot][i] = {
          addresses: currentPins[i].addresses,
          type: currentPins[i].type,
          id: currentPins[i].id,
        };
      }
    }
  }

  // can probably be removed but I've noticed some older versions left some [null] slots in the savedSlots
  savedSlots = savedSlots.map((savedSlot) => {
    if (savedSlot.length === 1 && savedSlot[0] === null) {
      return [];
    }
    return savedSlot;
  });

  localStorage.setItem('savedSlots', JSON.stringify(savedSlots));
  console.log(`Saved ${currentPins.length} pinned devices to slot ${activeSlot}!`);

  savedDevices = [];
  let i = 0;
  Object.keys(DEVICE.all).forEach((d) => {
    const device = DEVICE.all[d];
    savedDevices[i] = {
      addresses: device.addresses,
      type: device.type,
      displayName: device.displayName,
      defaultName: device.defaultName,
      port: device.port,
      id: device.id,
      fields: device.fields,
    };
    i++;
  });

  localStorage.setItem('savedDevices', JSON.stringify(savedDevices));
  console.log(`Saved ${savedDevices.length} devices to storage!`);
};

module.exports.removeDevice = function removeDevice(_device) {
  // remove devices from local savedDevices
  savedDevices = savedDevices.filter((device) => device.id !== _device.id);

  // remove devices from all saved slots
  for (let i = 1; i < savedSlots.length; i++) {
    savedSlots[i] = savedSlots[i].filter((device) => device.id !== _device.id);
  }

  // things might have changed so run a save
  this.saveAll();
};

module.exports.reloadActiveSlot = function reloadActiveSlot() {
  loadSlot(activeSlot);
};

module.exports.clearSavedData = function clearSavedData() {
  localStorage.removeItem('savedSlots');
  localStorage.removeItem('savedDevices');
};
