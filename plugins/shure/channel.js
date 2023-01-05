class Channel {
  constructor() {
    this.chan_name = '?';
    this.batt_bars = 255;
    this.batt_run_time = 65535;
    this.audio_gain = 0;
    this.audio_lvl = 0;
    this.rx_rf_lvl = 0;
    this.rf_antenna = 0;
    this.tx_type = 0;
  }
}

module.exports = Channel;
