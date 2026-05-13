exports.config = {
  defaultName: 'Ontime',
  connectionType: 'websocket',
  remotePort: 4001,
  mayChangePorts: false,
  heartbeatInterval: 500,
  heartbeatTimeout: 15000,
};

exports.ready = function ready(device) {
  const d = device;
  d.data = {
    timer: { current: null, playback: 'stop', addedTime: 0, duration: null, elapsed: null },
    eventNow: null,
    eventNext: null,
    clock: null,
  };
  d.send({ tag: 'poll' });
};

exports.data = function data(_device, msg) {
  const device = _device;

  if (!device.data) {
    device.data = {
      timer: { current: null, playback: 'stop', addedTime: 0, duration: null, elapsed: null },
      eventNow: null,
      eventNext: null,
      clock: null,
    };
  }

  // Ontime v4 sends all state updates as { tag: "runtime-data", payload: Partial<RuntimeStore> }
  // Poll responses arrive as { tag: "poll", payload: Partial<RuntimeStore> }
  if (msg.tag !== 'runtime-data' && msg.tag !== 'poll') return;

  const p = msg.payload;
  if (!p) return;
  if (p.timer !== undefined) device.data.timer = p.timer;
  if (p.eventNow !== undefined) device.data.eventNow = p.eventNow;
  if (p.eventNext !== undefined) device.data.eventNext = p.eventNext;
  if (p.clock !== undefined) device.data.clock = p.clock;

  device.draw();
};

exports.heartbeat = function heartbeat(device) {
  device.send({ tag: 'poll' });
};

exports.update = function update(_device, _doc, _updateType, _data) {};
