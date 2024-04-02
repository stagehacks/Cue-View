const _ = require('lodash');

exports.config = {
  defaultName: 'sACN',
  connectionType: 'multicast',
  remotePort: 5568,
  mayChangePorts: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'multicast',
    address: getMulticastGroup(1),
    port: 5568,
    validateResponse(msg, info) {
      return msg.toString('utf8', 4, 13) === 'ASC-E1.17';
    },
  },
};

exports.ready = function ready(device) {
  const d = device;
  d.data.universes = {};
  d.data.priorities = {};
  d.data.source = 'Unknown Source';
  d.data.orderedUniverses = [];

  const networkInterfaces = d.getNetworkInterfaces();

  for (let i = 1; i <= 16; i++) {
    for (let j = 0; j < Object.keys(networkInterfaces).length; j++) {
      const networkInterfaceID = Object.keys(networkInterfaces)[j];
      const networkInterface = networkInterfaces[networkInterfaceID];
      d.connection.addMembership(getMulticastGroup(i), networkInterface[0].address);
    }
  }
};

exports.data = function data(_device, buf) {
  const universeIndex = buf.readUInt16BE(113);
  const device = _device;

  let universe = device.data.universes[universeIndex];
  let priorities = device.data.priorities[universeIndex];

  if (!universe) {
    device.data.universes[universeIndex] = {};
    universe = device.data.universes[universeIndex];
  }
  if (!priorities) {
    device.data.priorities[universeIndex] = new Array(512).fill(0);
    priorities = device.data.priorities[universeIndex];
  }

  universe.sequence = buf.readUInt8(111);
  universe.priority = buf.readUInt8(108);
  universe.cid = buf.toString('hex', 22, 38);
  universe.slots = buf.slice(126);
  universe.startCode = buf.readUInt8(125);

  device.data.source = buf.toString('utf8', 44, 108);
  device.displayName = `${device.data.source} sACN`;
  device.data.ip = device.addresses[0];

  if (!_.includes(device.data.orderedUniverses, universeIndex)) {
    device.data.orderedUniverses.push(universeIndex);
    device.data.orderedUniverses.sort();
    universe.slotElems = [];
    universe.slotElemsSet = false;

    if (universe.priority > 0 && universe.startCode === 0) {
      device.draw();
      device.update('elementCache');
    }
  }
  if (universe.priority > 0 && universe.startCode === 0) {
    device.update('universeData', {
      universeIndex,
      universe,
      startCode: universe.startCode,
    });
  } else {
    device.data.priorities[universeIndex] = buf.slice(126);
  }
};

exports.heartbeat = function heartbeat(device) {};

let lastUpdate = Date.now();
exports.update = function update(_device, doc, updateType, updateData) {
  const device = _device;
  const data = updateData;

  if (updateType === 'universeData' && data.universe) {
    if (Date.now() - lastUpdate > 1000) {
      lastUpdate = Date.now();
      device.update('elementCache');
    }

    const $elem = doc.getElementById(`universe-${data.universeIndex}`);

    if ($elem && data.universe.slotElemsSet) {
      for (let i = 0; i < 512; i++) {
        data.universe.slotElems[i].textContent = data.universe.slots[i];
      }
      const $code = doc.getElementById(`universe-${data.universeIndex}-code`);
      if (data.startCode === 0xdd) {
        $code.textContent = 'Net3';
      } else if (data.startCode === 0x17) {
        $code.textContent = 'Text';
      } else if (data.startCode === 0xcf) {
        $code.textContent = 'SIP';
      } else if (data.startCode === 0xcc) {
        $code.textContent = 'RDM';
      }
    } else if (data.universe.startCode === 0) {
      device.draw();
      device.update('elementCache');
    }
  } else if (updateType === 'elementCache') {
    device.data.orderedUniverses.forEach((universeIndex) => {
      const universe = device.data.universes[universeIndex];

      if (doc.getElementById(`${universeIndex}-0`)) {
        for (let i = 0; i < 512; i++) {
          universe.slotElems[i] = doc.getElementById(`${universeIndex}-${i}`);
          universe.slotElems[i].title = `${universeIndex}/${i}   ${device.data.priorities[universeIndex][i]}`;
        }
        universe.slotElemsSet = true;
      }
    });
  }
};

// From https://github.com/hhromic/e131-node/blob/master/lib/e131.js
function getMulticastGroup(universe) {
  if (universe < 1 || universe > 63999) {
    throw new RangeError('universe should be in the range [1-63999]');
  }
  return `239.255.${universe >> 8}.${universe & 0xff}`;
}
