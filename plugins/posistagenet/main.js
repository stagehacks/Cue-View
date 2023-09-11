const { Decoder } = require('@jwetzell/posistagenet');

exports.config = {
  defaultName: 'PosiStageNet',
  connectionType: 'multicast',
  port: 56565,
  remotePort: 56565,
  mayChangePorts: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'multicast',
    address: getMulticastGroup(1),
    port: 56565,
    validateResponse(msg, info) {
      return true;
    },
  },
};

exports.ready = function ready(_device) {
  console.log('posistagenet is ready');
  const device = _device;
  device.psn = new Decoder();

  const networkInterfaces = device.getNetworkInterfaces();

  Object.keys(networkInterfaces).forEach((networkInterfaceID) => {
    const networkInterface = networkInterfaces[networkInterfaceID];
    device.connection.addMembership(getMulticastGroup(1), networkInterface[0].address);
  });
};

exports.data = function data(_device, buf) {
  const device = _device;
  if (device.psn) {
    device.psn.decode(buf);
    device.data = {
      data: device.psn.data,
      info: device.psn.info,
    };
    device.draw();
  }
};

exports.heartbeat = function heartbeat(device) {};

exports.update = function update(_device, doc, updateType, updateData) {};

function getMulticastGroup(universe) {
  return `236.10.10.10`;
}
