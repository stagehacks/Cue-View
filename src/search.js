const { ipcRenderer } = require('electron');
const dgram = require('dgram');
const bonjour = require('bonjour')();
const net = require('net');
const os = require('os');
const ip = require('ip');

const DEVICE = require('./device.js');
const PLUGINS = require('./plugins.js');

let searching = false;
let allServers = false;

function getServers() {
  const interfaces = os.networkInterfaces();
  const result = [];

  console.log(interfaces);

  Object.keys(interfaces).forEach((key) => {
    const addresses = interfaces[key];
    for (let i = addresses.length; i--; ) {
      const address = addresses[i];

      if (address.family === 'IPv4' && !address.internal && address.address.substring(0, 3) !== '169') {
        const subnet = ip.subnet(address.address, address.netmask);
        let current = ip.toLong(subnet.firstAddress);
        const last = ip.toLong(subnet.lastAddress) - 1;
        console.log(`range ${subnet.firstAddress} - ${subnet.lastAddress}`);
        while (current++ < last) result.push(ip.fromLong(current));
      }
    }
  });
  return result;
}

const searchSockets = [];
function searchAll() {
  if (searching) {
    return;
  }
  searching = true;
  ipcRenderer.send('disableSearchAll', '');
  document.getElementById('search-button').style.opacity = 0.2;
  console.log('Searching...');
  allServers = getServers();
  let TCPFlag = true;
  if (allServers.length > 2046) {
    alert(
      'Unable to search for TCP devices - subnet too large!\n\nCue View requires subnet 255.255.248.0 (/21) or smaller.'
    );
    TCPFlag = false;
  }

  Object.keys(PLUGINS.all).forEach((pluginType) => {
    const plugin = PLUGINS.all[pluginType];

    try {
      const searchType = plugin.config.searchOptions.type;

      if (searchType === 'TCPport') {
        if (TCPFlag) {
          searchTCP(pluginType, plugin.config);
        }
      } else if (searchType === 'Bonjour') {
        searchBonjour(pluginType, plugin.config);
      } else if (searchType === 'UDPsocket') {
        searchUDP(pluginType, plugin.config);
      } else if (searchType === 'multicast') {
        searchMulticast(pluginType, plugin.config);
      }
    } catch (err) {
      console.error(`Unable to search for plugin ${pluginType}`);
    }
  });

  setTimeout(() => {
    searching = false;
    document.getElementById('search-button').style.opacity = '';

    for (let i = 0; i < searchSockets.length; i++) {
      try {
        searchSockets[i].close();
      } catch (err) {
        //
      }
    }

    ipcRenderer.send('enableSearchAll', '');
  }, 10000);
}
module.exports.searchAll = searchAll;

function searchBonjour(pluginType, pluginConfig) {
  bonjour.find({ type: pluginConfig.searchOptions.bonjourName }, (e) => {
    const validAddresses = [];
    e.addresses.forEach((address) => {
      if (address.indexOf(':') === -1) {
        validAddresses.push(address);
      }
    });

    DEVICE.registerDevice({
      type: pluginType,
      defaultName: e.name,
      port: e.port,
      addresses: validAddresses,
    });
  });
}

function searchTCP(pluginType, pluginConfig) {
  for (let i = 0; i < allServers.length; i++) {
    TCPtest(allServers[i], pluginType, pluginConfig);
  }
}

function TCPtest(ipAddr, pluginType, pluginConfig) {
  const client = net.createConnection(pluginConfig.searchOptions.testPort, ipAddr, () => {
    client.write(pluginConfig.searchOptions.searchBuffer);
  });
  client.on('data', (data) => {
    if (pluginConfig.searchOptions.validateResponse(data)) {
      client.end(
        '',
        DEVICE.registerDevice({
          type: pluginType,
          defaultName: pluginConfig.defaultName,
          port: pluginConfig.defaultPort,
          addresses: [ipAddr],
        })
      );
    }
  });
  client.on('error', (err) => {
    // no device here
  });
}

function searchUDP(pluginType, pluginConfig) {
  const i = searchSockets.push(dgram.createSocket('udp4')) - 1;

  searchSockets[i].bind(pluginConfig.searchOptions.listenPort, () => {
    searchSockets[i].on('message', (msg, info) => {
      if (pluginConfig.searchOptions.validateResponse(msg, info, DEVICE.all)) {
        searchSockets[i].close();
        DEVICE.registerDevice({
          type: pluginType,
          defaultName: pluginConfig.defaultName,
          port: pluginConfig.defaultPort,
          addresses: [info.address],
        });
      }
    });
  });
  searchSockets[i].on('listening', () => {
    searchSockets[i].setBroadcast(true);
    searchSockets[i].send(
      pluginConfig.searchOptions.searchBuffer,
      pluginConfig.searchOptions.devicePort,
      '255.255.255.255',
      (err) => {
        // console.log(err)
      }
    );
  });
}

function searchMulticast(pluginType, pluginConfig) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, info) => {
    if (pluginConfig.searchOptions.validateResponse(msg, info)) {
      socket.close();
      DEVICE.registerDevice({
        type: pluginType,
        defaultName: pluginConfig.defaultName,
        port: pluginConfig.defaultPort,
        addresses: [info.address],
      });
    }
  });
  socket.bind(pluginConfig.searchOptions.port, () => {
    socket.addMembership(pluginConfig.searchOptions.address);
  });
}
