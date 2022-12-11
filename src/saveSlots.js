const VIEW = require('./view.js');
const DEVICE = require('./device.js');

let activeSlot = false;
let savedSlots = [[], [], [], []];
let savedDevices = [];

const storedSlots = localStorage.getItem('savedSlots');
if (storedSlots) {
  savedSlots = JSON.parse(storedSlots);
}

const storedDevices = localStorage.getItem('savedDevices');
if (storedDevices) {
  savedDevices = JSON.parse(storedDevices);
}

function loadSlot(slotIndex) {
  VIEW.toggleSlotButtons(slotIndex);
  activeSlot = slotIndex;

  Object.keys(DEVICE.all).forEach((d)=>{
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
};
module.exports.loadSlot = loadSlot;


module.exports.loadDevices = function loadDevices() {
  console.log(`Loading ${savedDevices.length} saved devices...`);

  for (let i = 0; i < savedDevices.length; i++) {
    DEVICE.registerDevice({
      type: savedDevices[i].type,
      displayName: savedDevices[i].displayName,
      defaultName: savedDevices[i].defaultName,
      port: savedDevices[i].port,
      addresses: savedDevices[i].addresses,
      id: savedDevices[i].id,
      fields: savedDevices[i].fields
    });
  }
};


module.exports.saveAll = function saveAll() {
  console.log('Saving...');
  const currentPins = VIEW.getPinnedDevices();

  savedSlots[activeSlot] = [];
  for (let i = 0; i < currentPins.length; i++) {
    savedSlots[activeSlot][i] = {
      addresses: currentPins[i].addresses,
      type: currentPins[i].type,
      id: currentPins[i].id
    };
  }
  localStorage.setItem('savedSlots', JSON.stringify(savedSlots));
  console.log(
    `Saved ${currentPins.length} pinned devices to slot ${activeSlot}!`
  );

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
      fields: device.fields
    };
    i++;
  });
  localStorage.setItem('savedDevices', JSON.stringify(savedDevices));

};


module.exports.deleteFromSlots = function deleteFromSlots(device) {
  for (let i = 1; i <= 3; i++) {
    console.log(savedSlots);
    for (let j = 0; j < savedSlots[i].length; j++) {
      if (savedSlots[i][j].id === device.id) {
        delete savedSlots[i][j];
      }
    }
  }
};


module.exports.reloadActiveSlot = function reloadActiveSlot() {
  loadSlot(activeSlot);
};


module.exports.resetSlots = function resetSlots() {
  localStorage.clear();
};
