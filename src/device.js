const { v4: uuid } = require('uuid');
const osc = require('osc');
const net = require('net');
const udp = require('dgram');
const { debounce } = require('lodash/function');

const PLUGINS = require('./plugins.js');
const VIEW = require('./view.js');
const SAVESLOTS = require('./saveSlots.js');

const devices = {};
module.exports.all = devices;

registerDevice = function (newDevice) {

  if (PLUGINS.all[newDevice.type] == undefined) {
    console.error(`Plugin for device ${newDevice.type} does not exist.`);
    return true;
  }

  const initElements = document.getElementsByClassName('init');
  for (let i = 0; i < initElements.length; i++) {
    initElements[i].style.display = 'none';
  }

  // only register device if it hasn't already been added
  if (newDevice.addresses.length > 0) {
    for (let i in devices) {
      if (
        devices[i].type == newDevice.type &&
        JSON.stringify(devices[i].addresses) ==
          JSON.stringify(newDevice.addresses)
      ) {
        // This device has already been added
        infoUpdate(devices[i], 'status', 'ok');
        return false;
      }
    }
  }

  // console.log("Registered new "+newDevice.type)

  const id = newDevice.id || uuid();
  devices[id] = {
    id,
    status: 'new',
    type: newDevice.type,
    displayName: newDevice.displayName,
    defaultName: newDevice.defaultName,
    port: newDevice.port,
    addresses: newDevice.addresses,
    data: {},
    pinIndex: false,
    lastDrawn: 0,
    lastHeartbeat: 0,
    heartbeatInterval: PLUGINS.all[newDevice.type].heartbeatInterval,
    draw: debounce(
      function () {
        VIEW.draw(this);
      },
      30,
      { leading: true, trailing: true }
    ),
  };

  VIEW.addDeviceToList(devices[id]);
  initDeviceConnection(id);
};
module.exports.registerDevice = registerDevice;

initDeviceConnection = function (id) {
  const device = devices[id];

  infoUpdate(device, 'status', 'new');

  if (device.port == undefined || device.addresses.length == 0) {
    return true;
  }
  try {
    // mostly only useful for UDP
    device.connection.close();
  } catch (err) {}

  const { type } = devices[id];
  const plugins = PLUGINS.all;

  if (plugins[type].connectionType == 'osc') {
    device.connection = new osc.TCPSocketPort({
      address: device.addresses[0],
      port: device.port,
    });
    device.connection.open();
    device.connection.on('error', (error) => {
      // console.error(error)
      device.connection.close();
    });
    device.connection.on('ready', () => {
      plugins[type].ready(device);
      if (Object.keys(devices).length == 1) {
        VIEW.switchDevice(device.id);
      }
    });
    device.connection.on('message', (message) => {
      // log("OSC IN", message.address);
      plugins[type].data(device, message);
      device.lastMessage = Date.now();
    });
    device.send = function (address, args) {
      device.connection.send({ address: address, args: args });
    };
    device.plugin = plugins[type];
  } else if (plugins[type].connectionType == 'TCPsocket') {
    device.connection = new net.Socket();

    device.connection.connect(
      { port: device.port, host: device.addresses[0] },
      () => {}
    );

    device.connection.on('error', (error) => {
      // console.error(error)
    });
    device.connection.on('ready', () => {
      plugins[type].ready(device);
      if (Object.keys(devices).length == 1) {
        VIEW.switchDevice(device.id);
      }
    });
    device.connection.on('data', (message) => {
      // log("SOCK IN", message);
      plugins[type].data(device, message);
      device.lastMessage = Date.now();
      infoUpdate(device, 'status', 'ok');
    });
    device.send = function (data) {
      // log("SOCK OUT", data);
      device.connection.write(data);
    };
  } else if (plugins[type].connectionType == 'UDPsocket') {
    device.connection = udp.createSocket('udp4');

    device.connection.bind(() => {
      plugins[type].ready(device);

      device.connection.on('message', (msg, info) => {
        plugins[type].data(device, msg);
        infoUpdate(device, 'status', 'ok');
      });
    });

    device.send = function (data) {
      device.connection.send(data, device.port, device.addresses[0], (err) => {
        // console.log(err);
      });
    };
  }
};
module.exports.initDeviceConnection = initDeviceConnection;

module.exports.deleteActive = function () {
  const device = VIEW.getActiveDevice();
  const choice = confirm(
    `Are you sure you want to delete ${device.type} device "${
      device.displayName || device.defaultName
    }"?`
  );

  if (choice) {
    VIEW.removeDeviceFromList(device);
    delete devices[device.id];
    SAVESLOTS.deleteFromSlots(device);
    SAVESLOTS.saveAll();
    SAVESLOTS.reloadActiveSlot();
  }
};

module.exports.changeActiveType = function (newType) {
  const device = VIEW.getActiveDevice();
  device.type = newType;

  initDeviceConnection(device.id);
  VIEW.draw(device);
  // SAVESLOTS.saveAll();
};

module.exports.changeActiveIP = function (newIP) {
  const device = VIEW.getActiveDevice();
  device.addresses[0] = newIP;
  initDeviceConnection(device.id);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};

module.exports.changeActivePort = function (newPort) {
  const device = VIEW.getActiveDevice();
  device.port = newPort;

  initDeviceConnection(device.id);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};

module.exports.changeActiveName = function (newName) {
  const device = VIEW.getActiveDevice();
  device.displayName = newName;
  infoUpdate(device, 'displayName', newName);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};
module.exports.changeActivePinIndex = function (newPin) {
  const device = VIEW.getActiveDevice();
  device.pinIndex = newPin;
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};
module.exports.changePinIndex = function (device, newPin) {
  device.pinIndex = newPin;
  // SAVESLOTS.saveAll();
};
module.exports.refreshActive = function () {
  const device = VIEW.getActiveDevice();
  if (device == undefined) {
    return true;
  }
  initDeviceConnection(device.id);
  VIEW.draw(device);
};

infoUpdate = function (device, param, value) {
  if (param == 'addresses') {
    device.addresses = value.replace(/\s+/g, '').split(',');
  } else {
    device[param] = value;
  }
  VIEW.addDeviceToList(device);
};
module.exports.infoUpdate = infoUpdate;

function heartbeat() {
  for (let i in devices) {
    const device = devices[i];
    if (Date.now() >= device.lastHeartbeat + device.heartbeatInterval) {
      if (device.status == 'broken') {
        initDeviceConnection(i);
      } else if (Date.now() - device.lastMessage > 10000) {
        infoUpdate(device, 'status', 'broken');
      } else {
        if (device.port != undefined && device.addresses.length > 0) {
          PLUGINS.all[device.type].heartbeat(device);
        } else {
          // console.error("Invalid IP/Port on device "+device.name)
        }
      }
      device.lastHeartbeat = Date.now();
    }
  }
}
setInterval(heartbeat, 100);
