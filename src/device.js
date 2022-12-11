const { v4: uuid } = require('uuid');
const osc = require('osc');
const net = require('net');
const udp = require('dgram');
const _ = require('lodash');

const PLUGINS = require('./plugins.js');
const VIEW = require('./view.js');
const SAVESLOTS = require('./saveSlots.js');

const devices = {};
module.exports.all = devices;

function registerDevice(newDevice) {
  if (PLUGINS.all[newDevice.type] === undefined) {
    console.error(`Plugin for device ${newDevice.type} does not exist.`);
    return true;
  }

  const initElements = document.getElementsByClassName('init');
  for (let i = 0; i < initElements.length; i++) {
    initElements[i].style.display = 'none';
  }

  // only register device if it hasn't already been added
  if (newDevice.addresses.length > 0) {
    const existing = _.find(devices, (e) => {
      const typeMatch = e.type === newDevice.type;
      const addressMatch =
        JSON.stringify(e.addresses) === JSON.stringify(newDevice.addresses);
      return typeMatch && addressMatch;
    });

    if (existing) {
      return false;
    }
  }

  // console.log("Registered new "+newDevice.type)

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
    fields: {},
    pinIndex: false,
    lastDrawn: 0,
    lastHeartbeat: 0,
    heartbeatInterval: PLUGINS.all[newDevice.type].heartbeatInterval,
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
  };

  devices[id].plugin = PLUGINS.all[newDevice.type];

  if(PLUGINS.all[newDevice.type].config.fields){
    PLUGINS.all[newDevice.type].config.fields.forEach(field => {
      devices[id].fields[field.key] = field.value;
    });
  }


  VIEW.addDeviceToList(devices[id]);
  initDeviceConnection(id);
  return true;
}
module.exports.registerDevice = registerDevice;

function initDeviceConnection(id) {
  const device = devices[id];

  infoUpdate(device, 'status', 'new');

  if(device.port === undefined){
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
      device.lastMessage = Date.now();
    });
    device.send = (address, args) => {
      device.connection.send({ address, args });
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
      infoUpdate(device, 'status', 'ok');
    });
    device.send = (data) => {
      // log("SOCK OUT", data);
      device.connection.write(data);
    };
  } else if (plugins[type].config.connectionType === 'UDPsocket') {
    device.connection = udp.createSocket('udp4');

    device.connection.bind({ port: plugins[type].defaultPort }, () => {
      plugins[type].ready(device);

      device.connection.on('message', (msg, info) => {
        plugins[type].data(device, msg);
        infoUpdate(device, 'status', 'ok');
      });
    });

    device.send = (data) => {
      device.connection.send(
        Buffer.from(data),
        device.port,
        device.addresses[0],
        (err) => {
          // console.log(err);
        }
      );
    };
  } else if (plugins[type].config.connectionType === 'multicast') {
    device.connection = udp.createSocket('udp4');

    device.connection.bind(device.port, () => {
      plugins[type].ready(device);

      device.connection.on('message', (msg, info) => {
        plugins[type].data(device, msg);
        infoUpdate(device, 'status', 'ok');
      });
    });

    device.send = (data) => {};
  }
  //device.plugin = plugins[type];

  return true;
}
module.exports.initDeviceConnection = initDeviceConnection;

module.exports.deleteActive = function deleteActive() {
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

module.exports.changeActiveType = function changeActiveType(newType) {
  const device = VIEW.getActiveDevice();
  device.type = newType;

  initDeviceConnection(device.id);
  VIEW.draw(device);
  // SAVESLOTS.saveAll();
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
  // SAVESLOTS.saveAll();
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
      } else if (d.port !== undefined && d.addresses.length > 0) {
        PLUGINS.all[d.type].heartbeat(d);
      } else {
        //
      }
      d.lastHeartbeat = Date.now();
    }
  });

  // for (let i in devices) {
  //   const device = devices[i];
  //   if (Date.now() >= device.lastHeartbeat + device.heartbeatInterval) {
  //     if (device.status == 'broken') {
  //       initDeviceConnection(i);
  //     } else if (Date.now() - device.lastMessage > device.heartbeatTimeout) {
  //       infoUpdate(device, 'status', 'broken');
  //     } else {
  //       if (device.port != undefined && device.addresses.length > 0) {
  //         PLUGINS.all[device.type].heartbeat(device);
  //       } else {
  //         // console.error("Invalid IP/Port on device "+device.name)
  //       }
  //     }
  //     device.lastHeartbeat = Date.now();
  //   }
  // }
}
setInterval(heartbeat, 100);
