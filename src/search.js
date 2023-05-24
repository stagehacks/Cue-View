const { ipcRenderer } = require('electron');
const dgram = require('dgram');
const bonjour = require('bonjour')();
const net = require('net');
const os = require('os');
const ip = require('ip');

const { Netmask } = require('netmask');
const DEVICE = require('./device.js');
const PLUGINS = require('./plugins.js');

let searching = false;
let allServers = false;
let validInterfaces = {};

function getServers() {
  const interfaces = os.networkInterfaces();
  const result = [];
  validInterfaces = {};

  Object.keys(interfaces).forEach((key) => {
    const addresses = interfaces[key];

    for (let i = addresses.length; i--; ) {
      const address = addresses[i];
      if (address.family === 'IPv4' && !address.internal && address.address.substring(0, 3) !== '169') {
        let subnet = ip.subnet(address.address, address.netmask);
        let current = ip.toLong(subnet.firstAddress);
        let last = ip.toLong(subnet.lastAddress) - 1;
        address.searchTruncated = false;

        if (last - current > 2296) {
          subnet = ip.subnet(address.address, '255.255.248.0');
          last = ip.toLong(subnet.lastAddress) - 1;
          address.searchTruncated = true;
        }

        // console.log(`range ${subnet.firstAddress} - ${subnet.lastAddress}`);

        address.broadcastAddress = subnet.broadcastAddress;
        address.firstSearchAddress = subnet.firstAddress;
        address.lastSearchAddress = subnet.lastAddress;

        if (!validInterfaces[key]) {
          validInterfaces[key] = [];
        }
        validInterfaces[key].push(address);

        while (current++ < last) result.push(ip.fromLong(current));
      }
    }
  });
  return result;
}
function getNetworkInterfaces() {
  getServers();
  return validInterfaces;
}
module.exports.getNetworkInterfaces = getNetworkInterfaces;

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
  if (allServers.length > 2296) {
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
      } else if (searchType === 'UDPScan') {
        searchUDPScan(pluginType, plugin.config);
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
      if (!address.includes(':')) {
        validAddresses.push(address);
      }
    });

    if (pluginConfig.searchOptions.validateResponse) {
      if (pluginConfig.searchOptions.validateResponse(e.fqdn)) {
        DEVICE.registerDevice(
          {
            type: pluginType,
            defaultName: e.name,
            port: e.port,
            addresses: validAddresses,
          },
          'fromSearch'
        );
      }
    } else {
      DEVICE.registerDevice(
        {
          type: pluginType,
          defaultName: e.name,
          port: e.port,
          addresses: validAddresses,
        },
        'fromSearch'
      );
    }
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
        'utf8',
        DEVICE.registerDevice(
          {
            type: pluginType,
            defaultName: pluginConfig.defaultName,
            port: pluginConfig.defaultPort,
            addresses: [ipAddr],
          },
          'fromSearch'
        )
      );
    }
  });
  client.on('error', (err) => {
    // no device here
  });
}

function searchUDPScan(pluginType, pluginConfig) {
  for (let i = 0; i < Object.keys(validInterfaces).length; i++) {
    const interfaceID = Object.keys(validInterfaces)[i];
    const interfaceObj = validInterfaces[interfaceID];
    interfaceObj.forEach((netInterface) => {
      const udpSocket = dgram.createSocket('udp4');
      udpSocket.bind(pluginConfig.searchOptions.listenPort, netInterface.address);

      udpSocket.on('message', (msg, info) => {
        if (pluginConfig.searchOptions.validateResponse(msg, info, DEVICE.all)) {
          udpSocket.close();
          DEVICE.registerDevice(
            {
              type: pluginType,
              defaultName: pluginConfig.defaultName,
              port: pluginConfig.defaultPort,
              addresses: [info.address],
            },
            'fromSearch'
          );
        }
      });
      const interfaceBlock = new Netmask(netInterface.cidr);
      interfaceBlock.forEach((address, long, index) => {
        udpSocket.send(pluginConfig.searchOptions.searchBuffer, pluginConfig.searchOptions.devicePort, address);
      });
    });
  }
}

function searchUDP(pluginType, pluginConfig) {
  for (let i = 0; i < Object.keys(validInterfaces).length; i++) {
    const interfaceID = Object.keys(validInterfaces)[i];
    const interfaceObj = validInterfaces[interfaceID];

    const j = searchSockets.push(dgram.createSocket('udp4')) - 1;

    searchSockets[j].bind(pluginConfig.searchOptions.listenPort, () => {
      searchSockets[j].on('message', (msg, info) => {
        if (pluginConfig.searchOptions.validateResponse(msg, info, DEVICE.all)) {
          searchSockets[j].close();
          DEVICE.registerDevice(
            {
              type: pluginType,
              defaultName: pluginConfig.defaultName,
              port: pluginConfig.defaultPort,
              addresses: [info.address],
            },
            'fromSearch'
          );
        }
      });
    });

    searchSockets[j].on('listening', () => {
      searchSockets[j].setBroadcast(true);
      searchSockets[j].send(
        pluginConfig.searchOptions.searchBuffer,
        pluginConfig.searchOptions.devicePort,
        interfaceObj[0].broadcastAddress,
        (err) => {
          // console.log(err);
        }
      );
    });
  }
}

function searchMulticast(pluginType, pluginConfig) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, info) => {
    if (pluginConfig.searchOptions.validateResponse(msg, info)) {
      socket.close(() => {
        DEVICE.registerDevice(
          {
            type: pluginType,
            defaultName: pluginConfig.defaultName,
            port: pluginConfig.defaultPort,
            addresses: [info.address],
          },
          'fromSearch'
        );
      });
    }
  });

  socket.bind(pluginConfig.searchOptions.port, () => {
    for (let i = 0; i < Object.keys(validInterfaces).length; i++) {
      const interfaceID = Object.keys(validInterfaces)[i];
      const interfaceObj = validInterfaces[interfaceID];

      socket.addMembership(pluginConfig.searchOptions.address, interfaceObj[0].address);
    }
  });
}
