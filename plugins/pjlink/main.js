const md5 = require('md5');

exports.defaultName = 'PJLink Projector';
exports.connectionType = 'TCPsocket';
exports.heartbeatInterval = 5000;
exports.heartbeatTimeout = 15000;
exports.searchOptions = {
  type: 'UDPsocket',
  searchBuffer: Buffer.from([0x25, 0x32, 0x53, 0x52, 0x43, 0x48, 0x0d]),
  devicePort: 4352,
  listenPort: 4352,
  validateResponse (msg, info) {
    return msg.toString().indexOf('%2ACKN=') >= 0;
  },
};
exports.defaultPort = 4352;

exports.ready = function ready(device) {
  // Power status query
  // device.send("%1POWR ?\r");
};
let password = false;

function processPJLink(device, str, that) {
  const arr = str.split('%');
  arr.shift();
  const d = device;

  arr.forEach((s) => {
    console.log(s)
    const split = s.split('=');
    const key = split[0];
    const value = split[1];

    if(key === '1POWR'){
      d.data.power = value;

    }else if(key === '1INPT'){
      d.data.input = value;
      
    }else if(key === '1AVMT'){
      d.data.avmute = value;
      
    }else if(key === '1ERST'){
      d.data.fanError = value[0];
      d.data.lampError = value[1];
      d.data.tempError = value[2];
      d.data.coverError = value[3];
      d.data.filterError = value[4];
      d.data.otherError = value[5];
      
    }else if(key === '1LAMP'){
      d.data.lamp = value.split(' ');
      
    }else if(key === '1NAME'){
      d.data.name = value;
      that.deviceInfoUpdate(d, 'defaultName', d.data.name);
      
    }else if(key === '1INF1'){
      d.data.info1 = value;
      
    }else if(key === '1INF2'){
      d.data.info2 = value;
      
    }else if(key === '2SNUM'){
      d.data.serial = value;
      
    }else if(key === '2SVER'){
      d.data.version = value;
      
    }
  });

  d.draw();

}

exports.data = function data(device, message) {
  this.deviceInfoUpdate(device, 'status', 'ok');
  const msg = message.toString();

  if (msg.substring(0, 8) === 'PJLINK 1') {
    password = md5(`${msg.substring(9, 17)}JBMIAProjectorLink`);
    device.send(
      `${password}%1POWR ?\r%1INPT ?\r%1AVMT ?\r%1ERST ?\r%1LAMP ?\r%1NAME ?\r%1INF1 ?\r%1INF2 ?\r%2SNUM ?\r%2SVER ?\r`
    );
  }
  if (msg.substring(0, 7) === '%1POWR=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1INPT=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1AVMT=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1ERST=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1LAMP=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1NAME=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1INF1=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%1INF2=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%2SNUM=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) === '%2SVER=') {
    processPJLink(device, msg, this);
  }
};

exports.heartbeat = function heartbeat(device) {
  if (password) {
    device.send(
      `${password}%1POWR ?\r%1INPT ?\r%1AVMT ?\r%1ERST ?\r%1LAMP ?\r%1NAME ?\r%1INF1 ?\r%1INF2 ?\r%2SNUM ?\r%2SVER ?\r`
    );
  }
};
