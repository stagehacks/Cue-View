const _ = require('lodash');

exports.config = {
  defaultName: 'Shure Wireless',
  connectionType: 'TCPsocket',
  heartbeatInterval: 10000,
  heartbeatTimeout: 15000,
  defaultPort: 2202,
  mayChangePort: false,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('< GET DEVICE_ID >', 'ascii'),
    testPort: 3032,
    validateResponse(msg, info) {
      return msg.toString().indexOf('DEVICE_ID');
    },
  },
};

const blankChannel = {
  chan_name: '?',
  batt_bars: 255,
  audio_gain: 0,
  audio_lvl: 0,
  rx_rf_lvl: 0,
  rf_antenna: 0,
  tx_type: 0,
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.channelCount = 0;
  device.data.channels = [
    {},
    _.clone(blankChannel),
    _.clone(blankChannel),
    _.clone(blankChannel),
    _.clone(blankChannel),
  ];
};

exports.data = function data(_device, message) {
  const device = _device;
  let msgStr = message.toString();

  if (!msgStr.startsWith('< ')) {
    return;
  }

  msgStr = msgStr.slice(2).slice(0, -1);
  const msgs = msgStr.split('><');

  msgs.forEach((ms, i) => {
    const msg = ms.trim();
    const m = msg.split(' ');
    const chi = Number(m[1]);
    const ch = device.data.channels[chi];

    if (m[0] === 'REP') {
      if (m[2] === 'CHAN_NAME') {
        ch.chan_name = msg.substring(17).slice(0, -2).trim();
        if (device.data.channelCount < chi) {
          device.data.channelCount = chi;
        }
        device.draw();
      } else if (msgParts[2] === 'BATT_BARS') {
        channel.batt_bars = Number(msgParts[3]);
      } else if (msgParts[2] === 'AUDIO_GAIN') {
        channel.audio_gain = Number(msgParts[3]) - 18;
      } else if (msgParts[2] === 'AUDIO_LVL') {
        channel.audio_lvl = Number(msgParts[3]);
      } else if (msgParts[2] === 'RX_RF_LVL') {
        channel.rx_rf_lvl = Number(msgParts[3]) - 128;
      } else if (msgParts[2] === 'RF_ANTENNA') {
        channel.rf_antenna = msgParts[3];
      } else if (msgParts[2] === 'TX_TYPE') {
        channel.tx_type = msgParts[3];
      } else if (msgParts[1] === 'DEVICE_ID') {
        const id = msg.substring(15).slice(0, -1).trim();
        this.deviceInfoUpdate(device, 'defaultName', id);
      } else if (m[1] === 'FW_VER') {
        device.data.version = m[2].substring(1);
      }
    } else if (m[0] === 'SAMPLE') {
      ch.rf_antenna = m[3];
      ch.rx_rf_lvl = Number(m[4]) - 128;
      ch.audio_lvl = Number(m[5]);
      if (chi === 4) {
        device.draw();
      }
    }
  });
};

exports.heartbeat = function heartbeat(device) {
  device.send('< GET 0 ALL >');
  device.send('< SET 0 METER_RATE 00100 >');
  device.send('< SAMPLE 0 AUDIO_LVL>');
};
