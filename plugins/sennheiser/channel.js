class Channel {
  constructor() {
    // common attributes
    this.frequency = {
      hz: null,
      bank: null,
      channel: null,
    };
    this.rfConfig = {
      min: null, // hz
      max: null, // hz
      step: null, // hz
    };
    this.name = '';
    this.mute = null; // 0 = disabled, 1 = enabled
    this.firmwareRevision = ''; // #.#.#

    this.msg = []; // list of msg strings (Ok, Low Battery, Low RF Signal, etc.)
    this.configIndex = null;

    // EM only
    this.em = {
      squelch: null,
      afOut: null,
      equalizer: null, // 0 = flat, 1 = low cut, 2 = low&high boost, 3 = high boost
      rf1: {
        min: null, // %
        max: null, // %
        active: null, // 0 = inactive, 1 = active
      },
      rf2: {
        min: null, // %
        max: null, // %
        active: null, // 0 = inactive, 1 = active
      },
      states: {
        mutes: {
          // 4 bit number 1 bit per flag 0 = disabled, 1 = enabled
          mute: null, // bit 0
          txMute: null, // bit 1
          rfMute: null, // bit 2
          rxMute: null, // bit 3
        },
        pilot: 0, // 0 = no pilot for cycle, 1 = pilot for whole cycle, 2 = pilot signle for part of cycle
      },
      rf: {
        level: 0, // %
        antenna: null, // 1 or 2
        pilot: null, // 0 = no pilot, 1 = pilot
      },
      af: {
        peak: 0, // %
        peakHold: 0, // %
        mute: {
          // 4 bit number 1 bit per flag
          mute: null,
          txMute: null,
          rfMute: null,
          rxMute: null,
        },
      },
      bat: null, // % 0,30,70,100
    };

    // SR Only
    this.sr = {
      sensitivity: null, // -42..0
      equalizer: {
        enabled: null, // 0=off,1=on
        low: null, // -5..5
        lowMid: null, // -5..5
        mid: null, // -5..5
        midHigh: null, // -5..5
        high: null, // -5..5
      },
      mode: null, // 0 = mono, 1 = stereo
      af: [
        {
          peak: 0, // %
          peakHold: 0, // %
        },
        {
          peak: 0, // %
          peakHold: 0, // %
        },
      ],
      states: {
        mute: null, // 0 = on, 1 = off
        muteFlag: null, // 0 = rf mute on whole cycle, 1 = rf mute off whole cycle, 2 = rf mute changed during cycle
      },
    };
  }
}

module.exports = Channel;
