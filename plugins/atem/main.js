const { infoUpdate } = require('../../src/device');

exports.config = {
  defaultName: 'ATEM',
  connectionType: 'atem',
  defaultPort: 9910,
  mayChangePort: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 6000,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from('', 'ascii'),
    testPort: 9910,
    validateResponse(msg, info) {
      return true;
    },
  },
};

exports.ready = function ready(_device) {
  console.log('atem ready');
};

exports.update = function update(device, _document, updateType, data) {
  const document = _document;

  if (updateType === 'tbar' && document.getElementById('tbar-pos')) {
    document.getElementById('tbar-pos').value = data;
  }
};

exports.data = function data(_device, msg) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');
  switch (msg.event) {
    case 'sourceConfiguration':
      if (device.data.source === undefined) {
        device.data.source = {};
      }
      if (device.data.source[msg.sourceID] === undefined) {
        device.data.source[msg.sourceID] = {
          tally: {
            preview: false,
            program: false,
          },
        };
      }

      device.data.source[msg.sourceID] = {
        ...device.data.source[msg.sourceID],
        ...msg.sourceConfiguration,
      };
      break;
    case 'sourceTally':
      if (device.data.source === undefined) {
        device.data.source = {};
      }
      if (device.data.source[msg.sourceID] === undefined) {
        device.data.source[msg.sourceID] = {};
      }
      device.data.source[msg.sourceID].tally = msg.state;
      device.draw();
      break;

    case 'connectionStateChange':
      device.draw();
      break;

    case 'rawCommand':
      if (msg.cmd.name === '_pin') {
        if (msg.cmd.data !== undefined) {
          infoUpdate(device, 'defaultName', msg.cmd.data.toString().trim());
        }
      } else if (msg.cmd.name === '_top') {
        device.data.topology = {
          MEs: msg.cmd.data[0],
          sources: msg.cmd.data[1],
          colorGens: msg.cmd.data[2],
          AUXs: msg.cmd.data[3],
          DSKs: msg.cmd.data[4],
          stingers: msg.cmd.data[5],
          DVEs: msg.cmd.data[6],
          superSources: msg.cmd.data[7],
        };
      } else if (msg.cmd.name === 'TrPs') {
        const tbarPos = msg.cmd.data.readUint16BE(4);
        device.update('tbar', tbarPos);
      }
      break;
    default:
      break;
  }
};

exports.heartbeat = function heartbeat(device) {};
