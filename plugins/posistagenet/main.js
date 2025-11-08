const { Decoder } = require('@jwetzell/posistagenet');

exports.config = {
  defaultName: 'PosiStageNet',
  connectionType: 'multicast',
  remotePort: 56565,
  mayChangePorts: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'multicast',
    address: `236.10.10.10`,
    port: 56565,
    validateResponse(msg, info) {
      // TODO(jwetzell): find a way to check that this is a posistagenet message
      return true;
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data = {};
  const networkInterfaces = device.getNetworkInterfaces();

  Object.keys(networkInterfaces).forEach((networkInterfaceID) => {
    const networkInterface = networkInterfaces[networkInterfaceID];
    device.connection.addMembership(`236.10.10.10`, networkInterface[0].address);
  });
};

exports.data = function data(_device, buf, info) {
  const device = _device;

  if (!device.decoders) {
    device.decoders = {};
  }

  if (!device.decoders[info.address]) {
    device.decoders[info.address] = new Decoder();
  }

  device.decoders[info.address].decode(buf);

  Object.keys(device.decoders).forEach((address) => {
    console.log(device.decoders[address].trackers)
    device.data[address] = {
      trackers: device.decoders[address].trackers,
      system_name: device.decoders[address].system_name,
      fields: getTrackerFields(device.decoders[address].trackers),
    };
  });
  device.draw();
};

function getTrackerFields(trackers) {
    const keys = new Set(
      Object.values(trackers)
        .map((tracker) => Object.keys(tracker))
        .flat(1)
    );

    // NOTE(jwetzell): remove fields that definitely exist
    keys.delete('id');
    keys.delete('has_subchunks');
    keys.delete('data_len');
    keys.delete('chunk_data');

    return keys;
}

exports.heartbeat = function heartbeat(device) {};

exports.update = function update(_device, doc, updateType, updateData) {};
