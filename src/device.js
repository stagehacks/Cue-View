const { v4: uuid } = require('uuid');
let osc = require('osc');
let net = require('net');
let udp = require('dgram');
var _ = require('lodash/function');

let PLUGINS = require('./plugins.js');
let VIEW = require('./view.js');
let SAVESLOTS = require('./saveSlots.js');

var devices = {};
module.exports.all = devices;

registerDevice = function (newDevice) {
  console.log(PLUGINS.all);

  if (PLUGINS.all[newDevice.type] == undefined) {
    console.error(`Plugin for device ${newDevice.type} does not exist.`);
    return true;
  }

  var initElements = document.getElementsByClassName('init');
  for (var i = 0; i < initElements.length; i++) {
    initElements[i].style.display = 'none';
  }

  // only register device if it hasn't already been added
  if (newDevice.addresses.length > 0) {
    for (var i in devices) {
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

  var id = newDevice.id || uuid();
  devices[id] = {
    id: id,
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
    draw: _.debounce(
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
  var device = devices[id];

  infoUpdate(device, 'status', 'new');

  if (device.port == undefined || device.addresses.length == 0) {
    return true;
  }
  try {
    // mostly only useful for UDP
    device.connection.close();
  } catch (err) {}

  const type = devices[id].type;
  var plugins = PLUGINS.all;

  if (plugins[type].connectionType == 'osc') {
    device.connection = new osc.TCPSocketPort({
      address: device.addresses[0],
      port: device.port,
    });
    device.connection.open();
    device.connection.on('error', function (error) {
      // console.error(error)
      device.connection.close();
    });
    device.connection.on('ready', function () {
      plugins[type].ready(device);
      if (Object.keys(devices).length == 1) {
        VIEW.switchDevice(device.id);
      }
    });
    device.connection.on('message', function (message) {
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
      function () {}
    );

    device.connection.on('error', function (error) {
      // console.error(error)
    });
    device.connection.on('ready', function () {
      plugins[type].ready(device);
      if (Object.keys(devices).length == 1) {
        VIEW.switchDevice(device.id);
      }
    });
    device.connection.on('data', function (message) {
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

    device.connection.bind(function () {
      plugins[type].ready(device);

      device.connection.on('message', function (msg, info) {
        plugins[type].data(device, msg);
        infoUpdate(device, 'status', 'ok');
      });
    });

    device.send = function (data) {
      device.connection.send(
        data,
        device.port,
        device.addresses[0],
        function (err) {
          // console.log(err);
        }
      );
    };
  }
};
module.exports.initDeviceConnection = initDeviceConnection;

module.exports.deleteActive = function () {
  var device = VIEW.getActiveDevice();
  var choice = confirm(
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
  var device = VIEW.getActiveDevice();
  device.type = newType;

  initDeviceConnection(device.id);
  VIEW.draw(device);
  // SAVESLOTS.saveAll();
};

module.exports.changeActiveIP = function (newIP) {
  var device = VIEW.getActiveDevice();
  device.addresses[0] = newIP;
  initDeviceConnection(device.id);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};

module.exports.changeActivePort = function (newPort) {
  var device = VIEW.getActiveDevice();
  device.port = newPort;

  initDeviceConnection(device.id);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};

module.exports.changeActiveName = function (newName) {
  var device = VIEW.getActiveDevice();
  device.displayName = newName;
  infoUpdate(device, 'displayName', newName);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};
module.exports.changeActivePinIndex = function (newPin) {
  var device = VIEW.getActiveDevice();
  device.pinIndex = newPin;
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};
module.exports.changePinIndex = function (device, newPin) {
  device.pinIndex = newPin;
  // SAVESLOTS.saveAll();
};
module.exports.refreshActive = function () {
  var device = VIEW.getActiveDevice();
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

setInterval(heartbeat, 100);
function heartbeat() {
  for (var i in devices) {
    var device = devices[i];
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
