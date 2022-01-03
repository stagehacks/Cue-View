let VIEW = require('./view.js');
let DEVICE = require('./device.js');

var activeSlot = false;
var savedSlots = [[], [], [], []];
var savedDevices = [];

var storedSlots = localStorage.getItem('savedSlots');
if (storedSlots) {
  savedSlots = JSON.parse(storedSlots);
}

var storedDevices = localStorage.getItem('savedDevices');
if (storedDevices) {
  savedDevices = JSON.parse(storedDevices);
}

loadSlot = function (slotIndex) {
  VIEW.toggleSlotButtons(slotIndex);
  activeSlot = slotIndex;

  for (var d in DEVICE.all) {
    DEVICE.changePinIndex(DEVICE.all[d], false);
  }
  VIEW.resetPinned();

  for (var d in savedSlots[slotIndex]) {
    var savedDevice = savedSlots[slotIndex][d];
    for (var d in DEVICE.all) {
      var device = DEVICE.all[d];
      //if(device.addresses[0] == savedDevice.addresses[0] && device.type == savedDevice.type){
      if (device.id == savedDevice.id) {
        VIEW.pinDevice(device);
        VIEW.switchDevice(device.id);
      } else if (
        device.addresses[0] == savedDevice.addresses[0] &&
        device.type == savedDevice.type &&
        savedDevice.addresses[0] != undefined
      ) {
        VIEW.pinDevice(device);
        VIEW.switchDevice(device.id);
      }
    }
  }
};
module.exports.loadSlot = loadSlot;

module.exports.loadDevices = function () {
  console.log(`Loading ${savedDevices.length} saved devices...`);
  console.log(savedDevices);

  for (var i = 0; i < savedDevices.length; i++) {
    DEVICE.registerDevice({
      type: savedDevices[i].type,
      displayName: savedDevices[i].displayName,
      defaultName: savedDevices[i].defaultName,
      port: savedDevices[i].port,
      addresses: savedDevices[i].addresses,
      id: savedDevices[i].id,
    });
  }
};

module.exports.saveAll = function () {
  console.log('Saving...');
  var currentPins = VIEW.getPinnedDevices();

  savedSlots[activeSlot] = [];
  for (var i = 0; i < currentPins.length; i++) {
    savedSlots[activeSlot][i] = {
      addresses: currentPins[i].addresses,
      type: currentPins[i].type,
      id: currentPins[i].id,
    };
  }
  localStorage.setItem('savedSlots', JSON.stringify(savedSlots));
  console.log(
    `Saved ${currentPins.length} pinned devices to slot ${activeSlot}!`
  );

  savedDevices = [];
  var i = 0;
  for (var d in DEVICE.all) {
    var device = DEVICE.all[d];
    savedDevices[i] = {
      addresses: device.addresses,
      type: device.type,
      displayName: device.displayName,
      defaultName: device.defaultName,
      port: device.port,
      id: device.id,
    };
    i++;
  }
  localStorage.setItem('savedDevices', JSON.stringify(savedDevices));
};

module.exports.deleteFromSlots = function (device) {
  for (var i = 1; i <= 3; i++) {
    console.log(savedSlots);
    for (var j = 0; j < savedSlots[i].length; j++) {
      if (savedSlots[i][j].id == device.id) {
        delete savedSlots[i][j];
      }
    }
  }
};

module.exports.reloadActiveSlot = function () {
  loadSlot(activeSlot);
};

module.exports.resetSlots = function () {
  localStorage.clear();
};
