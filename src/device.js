const { v4: uuid } = require('uuid');
const osc = require('osc');
const net = require('net');
const udp = require('dgram');
const { Atem } = require('atem-connection');
const PLUGINS = require('./plugins.js');
const VIEW = require('./view.js');
const SAVESLOTS = require('./saveSlots.js');
const SEARCH = require('./search.js');

const devices = {};
module.exports.all = devices;

function registerDevice(newDevice, discoveryMethod) {
  if (PLUGINS.all[newDevice.type] === undefined) {
    console.error(`Plugin for device ${newDevice.type} does not exist.`);
    return true;
  }

  const initElements = document.getElementsByClassName('init');
  for (let i = 0; i < initElements.length; i++) {
    initElements[i].style.display = 'none';
  }

  // prevent duplicate devices from being added via search
  if (isDeviceAlreadyAdded(newDevice) && discoveryMethod === 'fromSearch') {
    return false;
  }

  const id = newDevice.id || uuid();
  devices[id] = {
    id,
    status: 'new',
    drawn: false,
    type: newDevice.type,
    displayName: newDevice.displayName,
    defaultName: newDevice.defaultName,
    port: newDevice.port,
    addresses: newDevice.addresses,
    data: {},
    templates: {},
    fields: newDevice.fields || {},
    pinIndex: false,
    lastDrawn: 0,
    lastHeartbeat: 0,
    lastMessage: 0,
    sendQueue: [],
    heartbeatInterval: PLUGINS.all[newDevice.type].heartbeatInterval,
    heartbeatTimeout: PLUGINS.all[newDevice.type].heartbeatTimeout,
    trafficSignal: VIEW.trafficSignal,
    draw() {
      VIEW.draw(this);
    },
    update(type, data) {
      if (this.drawn) {
        VIEW.update(this, type, data);
      } else {
        this.draw();
      }
    },
    getNetworkInterfaces() {
      return SEARCH.getNetworkInterfaces();
    },
  };

  devices[id].plugin = PLUGINS.all[newDevice.type];

  if (Object.keys(devices[id].fields).length === 0 && PLUGINS.all[newDevice.type].config.fields) {
    PLUGINS.all[newDevice.type].config.fields.forEach((field) => {
      devices[id].fields[field.key] = field.value;
    });
  }

  VIEW.addDeviceToList(devices[id]);
  initDeviceConnection(id);
  return devices[id];
}
module.exports.registerDevice = registerDevice;

function initDeviceConnection(id) {
  const device = devices[id];

  infoUpdate(device, 'status', 'new');

  if (device.port === undefined) {
    device.port = device.plugin.config.defaultPort;
  }

  if (device.port === undefined || device.addresses.length === 0) {
    return true;
  }
  try {
    // mostly only useful for UDP
    device.connection.close();
  } catch (err) {
    //
  }

  const { type } = devices[id];
  const plugins = PLUGINS.all;

  if (plugins[type].config.connectionType.includes('osc')) {
    if (plugins[type].config.connectionType.includes('udp')) {
      device.connection = new osc.UDPPort({
        localAddress: '0.0.0.0',
        remoteAddress: device.addresses[0],
        remotePort: device.port,
      });
    } else {
      device.connection = new osc.TCPSocketPort({
        address: device.addresses[0],
        port: device.port,
      });
    }
    device.connection.open();
    device.connection.on('error', (error) => {
      // console.error(error)
      device.connection.close();
    });
    device.connection.on('ready', () => {
      plugins[type].ready(device);
      if (Object.keys(devices).length === 1) {
        VIEW.switchDevice(device.id);
      }
    });
    device.connection.on('message', (message) => {
      try {
        plugins[type].data(device, message);
      } catch (err) {
        console.error(err);
      }
      device.trafficSignal(device);
      device.lastMessage = Date.now();
    });
    device.send = (address, args) => {
      const addr = address;
      const arg = args;
      device.sendQueue.push({ address: addr, args: arg });
    };
    device.sendNow = (data) => {
      device.connection.send(data);
    };
  } else if (plugins[type].config.connectionType === 'TCPsocket') {
    device.connection = new net.Socket();
    device.connection.connect(
      {
        port: device.port,
        host: device.addresses[0],
      },
      () => {}
    );

    device.connection.on('error', (error) => {
      // console.error(error)
    });
    device.connection.on('ready', () => {
      plugins[type].ready(device);
      if (Object.keys(devices).length === 1) {
        VIEW.switchDevice(device.id);
      }
    });
    device.connection.on('data', (message) => {
      // log("SOCK IN", message);
      plugins[type].data(device, message);
      device.lastMessage = Date.now();
      device.trafficSignal(device);
      infoUpdate(device, 'status', 'ok');
    });
    device.send = (data) => {
      // log("SOCK OUT", data);
      device.sendQueue.push(data);
    };
    device.sendNow = (data) => {
      device.connection.write(data);
    };
  } else if (plugins[type].config.connectionType === 'UDPsocket') {
    device.connection = udp.createSocket('udp4');

    device.connection.bind({ port: plugins[type].config.defaultPort }, () => {
      plugins[type].ready(device);

      device.connection.on('message', (msg, info) => {
        plugins[type].data(device, msg);
        device.lastMessage = Date.now();
        device.trafficSignal(device);
        infoUpdate(device, 'status', 'ok');
      });
    });

    device.send = (data) => {
      device.sendQueue.push(data);
    };
    device.sendNow = (data) => {
      device.connection.send(Buffer.from(data), device.port, device.addresses[0], (err) => {
        // console.log(err);
      });
    };
  } else if (plugins[type].config.connectionType === 'multicast') {
    device.connection = udp.createSocket('udp4');

    device.connection.bind(device.port, () => {
      plugins[type].ready(device);

      device.connection.on('message', (msg, info) => {
        plugins[type].data(device, msg);
        device.lastMessage = Date.now();
        device.trafficSignal(device);
        infoUpdate(device, 'status', 'ok');
      });
    });

    device.send = (data) => {};
  } else if (plugins[type].config.connectionType === 'atem') {
    device.connection = new Atem({
      // this gets around the no workers nodejs error
      disableMultithreaded: true,
    });
    device.connection.connect(device.addresses[0]);

    device.connection.on('connected', () => {
      infoUpdate(device, 'status', 'ok');
      device.trafficSignal(device);
      plugins[type].ready(device);
    });

    device.connection.on('stateChanged', (state, pathToChange) => {
      device.lastMessage = Date.now();
      plugins[type].data(device, {
        pathToChange,
        state,
      });
      infoUpdate(device, 'status', 'ok');
    });
  }

  return true;
}
module.exports.initDeviceConnection = initDeviceConnection;

module.exports.deleteActive = function deleteActive() {
  const device = VIEW.getActiveDevice();
  const choice = confirm(
    `Are you sure you want to delete ${device.type} device "${device.displayName || device.defaultName}"?`
  );

  if (choice) {
    if (device.plugin.config.connectionType === 'TCPsocket') {
      device.connection.destroy();
    } else if (device.plugin.config.connectionType === 'UDPsocket') {
      device.connection.close();
    } else if (device.plugin.config.connectionType === 'multicast') {
      device.connection.close();
    } else if (device.plugin.config.connectionType.startsWith('osc')) {
      device.connection.close();
    }
    VIEW.removeDeviceFromList(device);
    delete devices[device.id];
    SAVESLOTS.removeDevice(device);
    SAVESLOTS.reloadActiveSlot();
  }
};

module.exports.changeActiveType = function changeActiveType(newType) {
  const device = VIEW.getActiveDevice();
  device.type = newType;
  device.fields = [];
  device.plugin = PLUGINS.all[newType];

  if (PLUGINS.all[device.type].config.fields) {
    PLUGINS.all[newType].config.fields.forEach((field) => {
      device.fields[field.key] = field.value;
    });
  }

  initDeviceConnection(device.id);
  VIEW.draw(device);
  VIEW.updateFields();
};

module.exports.changeActiveIP = function changeActiveIP(newIP) {
  const device = VIEW.getActiveDevice();
  device.addresses[0] = newIP;
  initDeviceConnection(device.id);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};

module.exports.changeActivePort = function changeActivePort(newPort) {
  const device = VIEW.getActiveDevice();
  device.port = newPort;

  initDeviceConnection(device.id);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};

module.exports.changeActiveName = function changeActiveName(newName) {
  const device = VIEW.getActiveDevice();
  device.displayName = newName;
  infoUpdate(device, 'displayName', newName);
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};
module.exports.changeActivePinIndex = function changeActivePinIndex(newPin) {
  const device = VIEW.getActiveDevice();
  device.pinIndex = newPin;
  VIEW.draw(device);
  SAVESLOTS.saveAll();
};
module.exports.changePinIndex = function changePinIndex(device, newPin) {
  const d = device;
  d.pinIndex = newPin;
};
module.exports.refreshActive = function refreshActive() {
  const device = VIEW.getActiveDevice();
  if (device === undefined) {
    return true;
  }
  initDeviceConnection(device.id);
  VIEW.draw(device);
  return true;
};

function infoUpdate(device, param, value) {
  const d = device;
  if (param === 'addresses') {
    d.addresses = value.replace(/\s+/g, '').split(',');
  } else {
    d[param] = value;
  }
  VIEW.addDeviceToList(device);
}
module.exports.infoUpdate = infoUpdate;

function heartbeat() {
  Object.keys(devices).forEach((deviceID) => {
    const d = devices[deviceID];

    if (Date.now() >= d.lastHeartbeat + d.heartbeatInterval) {
      if (d.status === 'broken') {
        initDeviceConnection(deviceID);
      } else if (Date.now() - d.lastMessage > d.heartbeatTimeout) {
        infoUpdate(d, 'status', 'broken');
      } else if (d.port !== undefined && d.addresses.length > 0 && d.send) {
        PLUGINS.all[d.type].heartbeat(d);
      } else {
        //
      }
      d.lastHeartbeat = Date.now();
    }

    if (d.sendQueue.length > 0 && d.sendNow) {
      d.sendNow(d.sendQueue[0]);
      d.sendQueue.shift();
    }
  });
}
setInterval(heartbeat, 50);

function networkTick() {
  Object.keys(devices).forEach((deviceID) => {
    const d = devices[deviceID];

    if (d.sendQueue.length > 0 && d.sendNow) {
      d.sendNow(d.sendQueue[0]);
      d.sendQueue.shift();
      d.trafficSignal(d);
    }
  });
}
setInterval(networkTick, 10);

function isDeviceAlreadyAdded(newDevice) {
  let deviceAlreadyAdded = false;

  if (newDevice.addresses.length === 0) {
    return false;
  }

  for (let i = 0; i < Object.keys(devices).length; i++) {
    const device = devices[Object.keys(devices)[i]];
    const typeMatch = device.type === newDevice.type;
    const addressMatch = JSON.stringify(device.addresses) === JSON.stringify(newDevice.addresses);
    const idMatch = device.id === newDevice.id;
    if (typeMatch && addressMatch && !idMatch) {
      deviceAlreadyAdded = true;
      break;
    }
  }
  return deviceAlreadyAdded;
}
module.exports.isDeviceAlreadyAdded = isDeviceAlreadyAdded;
