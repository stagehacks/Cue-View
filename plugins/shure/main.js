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
  fields: [
    {
      key: 'chanCount',
      label: 'Chan',
      type: 'textinput',
      value: '4',
      action(device) {
        // device.plugin.heartbeat(device);
      },
    },
  ],
};

const blankChannel = {
  chan_name: '?',
  batt_bars: 255,
  batt_charge: '',
  batt_cycle: '',
  batt_health: '',
  batt_run_time: '',
  batt_temp_c: '',
  batt_temp_f: '',
  batt_type: '',
  audio_gain: '',
  audio_mute: '',
  tx_mute_button_status: '',
  audio_lvl: 0,
  rx_rf_lvl: 0,
};

exports.ready = function ready(device) {
  device.data.channels = [
    {},
    _.clone(blankChannel),
    _.clone(blankChannel),
    _.clone(blankChannel),
    _.clone(blankChannel),
  ];
};

exports.data = function data(device, message) {
  let msgStr = message.toString();

  if (!msgStr.startsWith('< ')) {
    return;
  }

  msgStr = msgStr.slice(2).slice(0, -1);
  const msgs = msgStr.split('><');

  msgs.forEach((msg, i) => {
    msg = msg.trim();
    const m = msg.split(' ');

    // console.log(msg);

    const ch = device.data.channels[Number(m[1])];

    // console.log(m);

    if (m[0] == 'REP') {
      if (m[2] == 'CHAN_NAME') {
        ch.chan_name = msg.substring(17).slice(0, -2).trim();
      } else if (m[2] == 'BATT_RUN_TIME') {
        ch.batt_run_time = Number(m[3]);
      } else if (m[2] == 'BATT_TEMP_F') {
        ch.batt_temp_f = Number(m[3]);
      } else if (m[2] == 'BATT_HEALTH') {
        ch.batt_health = Number(m[3]);
      } else if (m[2] == 'BATT_BARS') {
        ch.batt_bars = Number(m[3]);
      } else if (m[2] == 'AUDIO_GAIN') {
        ch.audio_gain = Number(m[3]) - 18;
      } else if (m[2] == 'AUDIO_MUTE') {
        ch.audio_mute = m[3];
      } else if (m[2] == 'TX_MUTE_BUTTON_STATUS') {
        ch.tx_mute_button_status = m[3];
      } else if (m[2] == 'AUDIO_LVL') {
        ch.audio_lvl = Number(m[3]);
      } else if (m[2] == 'RX_RF_LVL') {
        ch.rx_rf_lvl = Number(m[3]) - 128;
      } else if (m[2] == 'RF_ANTENNA') {
        ch.rf_antenna = m[3];
      } else if (m[2] == 'TX_TYPE') {
        ch.tx_type = m[3];
      } else if (m[1] == 'DEVICE_ID') {
        const id = msg.substring(15).slice(0, -1).trim();
        this.deviceInfoUpdate(device, 'defaultName', id);
      } else if (m[1] == 'FW_VER') {
        device.data.version = m[2].substring(1);
      }
    } else if (m[0] == 'SAMPLE') {
      ch.rf_antenna = m[3];
      ch.rx_rf_lvl = Number(m[4]) - 128;
      ch.audio_lvl = Number(m[5]);
    }
  });

  device.draw();
};

exports.heartbeat = function heartbeat(device) {
  device.send('< GET 0 ALL >');
  device.send('< SET 0 METER_RATE 00200 >');
  device.send('< SAMPLE 0 AUDIO_LVL>');
};
