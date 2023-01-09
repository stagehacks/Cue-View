const Channel = require('./channel');

exports.config = {
  defaultName: 'Shure Wireless',
  connectionType: 'TCPsocket',
  heartbeatInterval: 5000,
  heartbeatTimeout: 10000,
  defaultPort: 2202,
  mayChangePort: false,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('< GET DEVICE_ID >', 'ascii'),
    testPort: 2202,
    validateResponse(msg, info) {
      return msg.toString().includes('DEVICE_ID');
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.channelCount = 0;
  device.data.channels = [{}, new Channel(), new Channel(), new Channel(), new Channel()];
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
    const msgParts = msg.split(' ');
    const channelNumber = Number(msgParts[1]);
    const channel = device.data.channels[channelNumber];

    if (msgParts[0] === 'REP') {
      if (msgParts[2] === 'CHAN_NAME') {
        channel.chan_name = msg.substring(17).slice(0, -2).trim();
        if (device.data.channelCount < channelNumber) {
          device.data.channelCount = channelNumber;
        }
        device.draw();
      } else if (msgParts[2] === 'BATT_BARS') {
        channel.batt_bars = Number(msgParts[3]);
      } else if (msgParts[2] === 'BATT_RUN_TIME') {
        channel.batt_run_time = Number(msgParts[3]);
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
        device.draw();
      } else if (msgParts[1] === 'DEVICE_ID') {
        const id = msg.substring(15).slice(0, -1).trim();
        this.deviceInfoUpdate(device, 'defaultName', id);
      } else if (msgParts[1] === 'FW_VER') {
        device.data.version = msgParts[2].substring(1);
      }
    } else if (msgParts[0] === 'SAMPLE') {
      channel.rf_antenna = msgParts[3];
      channel.rx_rf_lvl = Number(msgParts[4]) - 128;
      channel.audio_lvl = Number(msgParts[5]);
      if (channelNumber === 4) {
        device.update('updateSample', {
          channels: device.data.channels,
        });
      }
    }
  });
};

exports.update = function update(device, doc, updateType, data) {
  for (let i = 1; i < data.channels.length; i++) {
    const channel = data.channels[i];

    const $rf = doc.getElementById(`ch-${i}-rf`);
    if ($rf) {
      $rf.style.height = 90 - (channel.rx_rf_lvl + 90) * 2;
    }

    const $audio = doc.getElementById(`ch-${i}-audio`);
    if ($audio) {
      $audio.style.height = 90 - channel.audio_lvl * 2;
    }

    const $rfA = doc.getElementById(`ch-${i}-a`);
    const $rfB = doc.getElementById(`ch-${i}-b`);

    if ($rfA) {
      if (channel.rf_antenna.charAt(0) === 'A') {
        $rfA.style.color = '#53c3c3';
      } else {
        $rfA.style.color = '#333';
      }
    }
    if ($rfB) {
      if (channel.rf_antenna.charAt(1) === 'B') {
        $rfB.style.color = '#53c3c3';
      } else {
        $rfB.style.color = '#333';
      }
    }
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send('< GET 0 ALL >');
  device.send('< SET 0 METER_RATE 00100 >');
  device.send('< SAMPLE 0 AUDIO_LVL>');
};
