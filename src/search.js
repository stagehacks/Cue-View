const { ipcRenderer } = require('electron');
const dgram = require('dgram');
const bonjour = require('bonjour')();
const net = require('net');
const os = require('os');
const ip = require('ip');

const DEVICE = require('./device.js');
// const SEARCH = require('./search.js');
const PLUGINS = require('./plugins.js');

let searching = false;
let allServers = false;

function getServers() {
  const interfaces = os.networkInterfaces();
  const result = [];
  
  Object.keys(interfaces).forEach((key) => {
    const addresses = interfaces[key];
    for (let i = addresses.length; i--; ) {
      const address = addresses[i];

      if (address.family === 'IPv4' && !address.internal && address.address.substring(0, 3)!="169") {
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

  Object.keys(DEVICE.all).forEach((i) => {
    DEVICE.infoUpdate(DEVICE.all[i], 'status', 'refresh');
  });

  console.log('Searching...');

  allServers = getServers();
  let TCPFlag = true;
  if (allServers.length > 2046) {
    alert(
      'Unable to search for TCP devices - subnet too large!\n\nCue View requires subnet 255.255.248.0 (/21) or smaller.'
    );
    TCPFlag = false;
  }

  Object.keys(PLUGINS.all).forEach((p) => {
    const plugin = PLUGINS.all[p];
    
    try {
      const t = plugin.config.searchOptions.type;

      if(t === 'TCPport'){
        if (TCPFlag) {
          searchTCP(p, plugin.config);
        }

      }else if(t === 'Bonjour'){
        searchBonjour(p, plugin.config);

      }else if(t === 'UDPsocket'){
        searchUDP(p, plugin.config);

      }else if(t === 'multicast'){
        searchMulticast(p, plugin.config);

      }

    } catch (err) {
      console.error(`Unable to search for plugin ${p}`);
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
};
module.exports.searchAll = searchAll;



function searchBonjour(pluginType, plugin) {
  bonjour.find({ type: plugin.searchOptions.bonjourName }, (e) => {

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

};


function searchTCP(pluginType, plugin) {
  for (let i = 0; i < allServers.length; i++) {
    TCPtest(allServers[i], pluginType, plugin);
  }
};

function TCPtest(ipAddr, pluginType, plugin) {
  const client = net.createConnection(plugin.searchOptions.testPort, ipAddr, () => {
    client.write(plugin.searchOptions.searchBuffer);
  });
  client.on('data', (data) => {
    if (plugin.searchOptions.validateResponse(data)) {
      DEVICE.registerDevice({
        type: pluginType,
        defaultName: plugin.defaultName,
        port: plugin.defaultPort,
        addresses: [ipAddr],
      });
    }
    client.end();
  });
  client.on('error', (err) => {
    // no device here
  });
};


function searchUDP(pluginType, plugin) {
  const i = searchSockets.push(dgram.createSocket('udp4')) - 1;

  searchSockets[i].bind(plugin.searchOptions.listenPort, () => {
    
    // searchSockets[i].send(
    //   plugin.searchOptions.searchBuffer,
    //   plugin.searchOptions.devicePort,
    //   '255.255.255.255',
    //   (err) => {
    //     // console.log(err)
    //   }
    // );
    // setTimeout(() => {
    //   searchSockets[i].send(
    //     plugin.searchOptions.searchBuffer,
    //     plugin.searchOptions.devicePort,
    //     '255.255.255.255',
    //     (err) => {
    //       // console.log(err)
    //     }
    //   );
    // }, 100);
    // setTimeout(() => {
    //   console.log('send')
    //   searchSockets[i].send(
    //     plugin.searchOptions.searchBuffer,
    //     plugin.searchOptions.devicePort,
    //     '255.255.255.255',
    //     (err) => {
    //       // console.log(err)
    //     }
    //   );
    // }, 400);

    searchSockets[i].on('message', (msg, info) => {
      if (plugin.searchOptions.validateResponse(msg, info, DEVICE.all)) {
        searchSockets[i].close();
        DEVICE.registerDevice({
          type: pluginType,
          defaultName: plugin.defaultName,
          port: plugin.defaultPort,
          addresses: [info.address],
        });
      }
    });
  });
  searchSockets[i].on('listening', () => {
    searchSockets[i].setBroadcast(true);
    searchSockets[i].send(
        plugin.searchOptions.searchBuffer,
        plugin.searchOptions.devicePort,
        '255.255.255.255',
        (err) => {
          // console.log(err)
        }
      );
  });
};


function searchMulticast(pluginType, plugin) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, info) => {
    if (plugin.searchOptions.validateResponse(msg, info)) {
      socket.close();
      DEVICE.registerDevice({
        type: pluginType,
        defaultName: plugin.defaultName,
        port: plugin.defaultPort,
        addresses: [info.address],
      });
    }
  });
  socket.bind(plugin.searchOptions.port, () => {
    socket.addMembership(plugin.searchOptions.address);
  });
}
