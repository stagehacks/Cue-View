const { ipcRenderer } = require('electron');
const { Netmask } = require('netmask');
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

// from local-devices library
function getServers() {
  const interfaces = os.networkInterfaces();
  const result = [];

  for (const key in interfaces) {
    const addresses = interfaces[key];
    for (let i = addresses.length; i--; ) {
      const address = addresses[i];
      if (address.family === 'IPv4' && !address.internal) {
        const subnet = ip.subnet(address.address, address.netmask);
        let current = ip.toLong(subnet.firstAddress);
        const last = ip.toLong(subnet.lastAddress) - 1;
        while (current++ < last) result.push(ip.fromLong(current));
      }
    }
  }

  return result;
}

const searchSockets = [];

searchAll = function () {
  if (searching) {
    return true;
  }
  searching = true;
  ipcRenderer.send('disableSearchAll', '');
  document.getElementById('search-button').style.opacity = 0.2;
  // console.clear();

  for (let i in DEVICE.all) {
    DEVICE.infoUpdate(DEVICE.all[i], 'status', 'refresh');
  }

  console.log('Searching...');

  // findOnlineDevices();
  allServers = getServers();
  let TCPFlag = true;
  if (allServers.length > 2046) {
    alert(
      'Unable to search for TCP devices - subnet too large!\n\nCue View requires subnet 255.255.248.0 (/21) or smaller.'
    );
    TCPFlag = false;
  }

  console.log(PLUGINS);

  for (let p in PLUGINS.all) {
    const plugin = PLUGINS.all[p];
    console.log(p);
    try {
      switch (plugin.searchOptions.type) {
        case 'TCPport':
          if (TCPFlag) {
            newSearchTCP(p, plugin);
          }
          break;
        case 'Bonjour':
          newSearchBonjour(p, plugin);
          break;
        case 'UDPsocket':
          newSearchUDP(p, plugin);
          break;
      }
    } catch (err) {
      console.error(`Unable to search for plugin ${p}`);
    }
  }

  // searchBonjour();
  // searchTCP();
  // searchUDP();

  setTimeout(() => {
    searching = false;
    document.getElementById('search-button').style.opacity = '';

    for (let i = 0; i < searchSockets.length; i++) {
      try {
        searchSockets[i].close();
      } catch (err) {}
    }

    ipcRenderer.send('enableSearchAll', '');
  }, 5000);
};
module.exports.searchAll = searchAll;

//  ____              _
// |  _ \            (_)
// | |_) | ___  _ __  _  ___  _   _ _ __
// |  _ < / _ \| '_ \| |/ _ \| | | | '__|
// | |_) | (_) | | | | | (_) | |_| | |
// |____/ \___/|_| |_| |\___/ \__,_|_|
//                  _/ |
//                 |__/

newSearchBonjour = function (pluginType, plugin) {
  bonjour.find({ type: plugin.searchOptions.bonjourName }, (e) => {
    console.log(pluginType);

    const validAddresses = [];
    for (let i in e.addresses) {
      if (e.addresses[i].indexOf(':') == -1) {
        validAddresses.push(e.addresses[i]);
      }
    }

    DEVICE.registerDevice({
      type: pluginType,
      defaultName: e.name,
      port: e.port,
      addresses: validAddresses,
    });
  });
};

// searchBonjour = function(){
// 	bonjour.find({type: "qlab"}, function(e){
// 		for(var i in e.addresses){
// 			if(e.addresses[i].indexOf(":")){
// 				e.addresses.splice(i, 1);
// 			}
// 		}
// 		DEVICE.registerDevice({
// 			type: "qlab",
// 			name: e.name,
// 			port: e.port,
// 			addresses: e.addresses
// 		})
// 	});

// }

//  _______ _____ _____
// |__   __/ ____|  __ \
//    | | | |    | |__) |
//    | | | |    |  ___/
//    | | | |____| |
//    |_|  \_____|_|

newSearchTCP = function (pluginType, plugin) {
  for (let i = 0; i < allServers.length; i++) {
    TCPtest(allServers[i], pluginType, plugin);
  }
};

TCPtest = function (ip, pluginType, plugin) {
  const client = net.createConnection(plugin.searchOptions.testPort, ip, () => {
    client.write(plugin.searchOptions.searchBuffer);
    // DEVICE.registerDevice({
    // 	type: pluginType,
    // 	defaultName: plugin.defaultName,
    // 	port: plugin.defaultPort,
    // 	addresses: [ip]
    // })
  });
  client.on('data', (data) => {
    if (plugin.searchOptions.validateResponse(data)) {
      DEVICE.registerDevice({
        type: pluginType,
        defaultName: plugin.defaultName,
        port: plugin.defaultPort,
        addresses: [ip],
      });
    }
    client.end();
  });
  client.on('error', (err) => {
    // no device here
  });
};

findOnlineDevices = function () {
  const allInterfaces = os.networkInterfaces();
  const validInterfaces = [];
  for (let i in allInterfaces) {
    for (let j = 0; j < allInterfaces[i].length; j++) {
      const iface = allInterfaces[i][j];

      if (
        iface.family == 'IPv4' &&
        iface.internal == false &&
        iface.address.split('.')[0] != '169'
      ) {
        validInterfaces.push(iface);
      }
    }
  }

  for (let i = 0; i < validInterfaces.length; i++) {
    const block = new Netmask(validInterfaces[i].cidr);
    const f = block.first.split('.');
    const l = block.last.split('.');
    const cur = [f[0], f[1], f[2], f[3]];

    for (let j = Number(f[2]); j <= Number(l[2]); j++) {
      cur[2] = j;
      for (let k = Number(f[3]); k < Number(l[3]); k++) {
        cur[3] = k;
        allIPs.push(`${cur[0]}.${cur[1]}.${cur[2]}.${cur[3]}`);
      }
    }
  }
};

// window.searchTCP = function(){
// 	var allInterfaces = require('os').networkInterfaces();
// 	var validInterfaces = [];
// 	for(var i in allInterfaces){
// 		for(var j=0; j<allInterfaces[i].length; j++){
// 			var iface = allInterfaces[i][j];

// 			if(iface.family=="IPv4" && iface.internal==false && iface.address.split(".")[0]!="169"){
// 				validInterfaces.push(iface);
// 			}
// 		}
// 	}

// 	for(var i=0; i<validInterfaces.length; i++){
// 		var block = new netmask(validInterfaces[i].cidr);
// 		var f = block.first.split(".");
// 		var l = block.last.split(".");
// 		var cur = [f[0], f[1], f[2], f[3]];

// 		for(var j=Number(f[2]); j<=Number(l[2]); j++){
// 			cur[2] = j;
// 			for(var k = Number(f[3]); k<Number(l[3]); k++){
// 				cur[3] = k;
// 				var ip = cur[0]+"."+cur[1]+"."+cur[2]+"."+cur[3];

// 				TCPtest(ip, 3033);
// 				TCPtest(ip, 3039);
// 				TCPtest(ip, 3040);
// 			}
// 		}
// 	}
// }
// TCPtest = function(address, port){
// 	var client = net.createConnection(port, address, function(){
// 		if(port==3033){
// 			DEVICE.registerDevice({
// 				type: "eos",
// 				name: "ETC Eos Console",
// 				port: 3032,
// 				addresses: [address]
// 			});
// 		}else if(port==3040){
// 			DEVICE.registerDevice({
// 				type: "watchout",
// 				name: "Watchout",
// 				port: 3040,
// 				addresses: [address]
// 			});
// 		}
// 	});
// 	client.on("error", function(err){
// 	 	//no EOS here
// 	});
// }

//  _    _ _____  _____
// | |  | |  __ \|  __ \
// | |  | | |  | | |__) |
// | |  | | |  | |  ___/
// | |__| | |__| | |
//  \____/|_____/|_|

const pjLinkMessage = Buffer.from([0x25, 0x32, 0x53, 0x52, 0x43, 0x48, 0x0d]);
const xAirMessage = Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]);
const serverUDP = dgram.createSocket('udp4');
const serverUDP2 = dgram.createSocket('udp4');

newSearchUDP = function (pluginType, plugin) {
  const i = searchSockets.push(dgram.createSocket('udp4')) - 1;
  searchSockets[i].bind(plugin.searchOptions.listenPort, () => {
    searchSockets[i].send(
      plugin.searchOptions.searchBuffer,
      plugin.searchOptions.devicePort,
      '255.255.255.255',
      (err) => {
        // console.log(err)
      }
    );
    setTimeout(() => {
      searchSockets[i].send(
        plugin.searchOptions.searchBuffer,
        plugin.searchOptions.devicePort,
        '255.255.255.255',
        (err) => {
          // console.log(err)
        }
      );
    }, 100);
    setTimeout(() => {
      searchSockets[i].send(
        plugin.searchOptions.searchBuffer,
        plugin.searchOptions.devicePort,
        '255.255.255.255',
        (err) => {
          // console.log(err)
        }
      );
    }, 400);

    searchSockets[i].on('message', (msg, info) => {
      if (plugin.searchOptions.validateResponse(msg, info)) {
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
  });
};

// searchUDP = function(){

// 	dgramPJLink = dgram.createSocket('udp4');
// 	dgramPJLink.bind(function(){
// 		dgramPJLink.send(pjLinkMessage, 4352, '255.255.255.255', (err) => {
// 			//console.log(err)
// 		});
// 		dgramPJLink.on('message',function(msg,info){
// 			if(msg.toString().indexOf("%2ACKN")==0){
// 				DEVICE.registerDevice({
// 					type: "pjlink",
// 					name: "PJLink Projector",
// 					port: 4352,
// 					addresses: [info.address]
// 				})
// 			}
// 		});

// 	});
// 	dgramPJLink.on('listening', function(){
// 	    dgramPJLink.setBroadcast(true);
// 	});

// 	dgramXAir = dgram.createSocket('udp4');
// 	dgramXAir.bind(function(){
// 		dgramXAir.send(xAirMessage, 10024, '255.255.255.255', (err) => {
// 			//console.log(err)
// 		});
// 		setTimeout(function(){
// 			dgramXAir.send(xAirMessage, 10024, '255.255.255.255', (err) => {
// 				//console.log(err)
// 			});
// 		}, 100);

// 		dgramXAir.on('message',function(msg,info){
// 			if(msg.toString().indexOf("/xinfo,ssss")){
// 				DEVICE.registerDevice({
// 					type: "xair",
// 					name: "X Air Mixer",
// 					port: 10024,
// 					addresses: [info.address]
// 				})
// 			}
// 		});

// 	});
// 	dgramXAir.on('listening', function(){
// 	    dgramXAir.setBroadcast(true);
// 	});

// }
