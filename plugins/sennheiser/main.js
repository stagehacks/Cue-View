const Channel = require('./channel');

exports.config = {
  defaultName: 'Sennheiser Wireless',
  connectionType: 'UDPsocket',
  heartbeatInterval: 5000,
  heartbeatTimeout: 10000,
  defaultPort: 53212,
  mayChangePort: false,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from('Name\r', 'ascii'),
    devicePort: 53212,
    listenPort: 53212,
    validateResponse(msg, info) {
      return msg.toString().includes('Name');
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;

  // send an immediate request for both types of attributes
  _device.send('Push 0 0 1');
  _device.send('Push 0 0 2');

  device.data.channel = new Channel();
};

exports.data = function data(_device, message) {
  console.log(message);
  // Parse return message
};

exports.update = function update(device, doc, updateType, data) {};

exports.heartbeat = function heartbeat(device) {
  // tell unit to send both attribute updates every 500ms for 5 seconds
  device.send('Push 5 500 3');
};
