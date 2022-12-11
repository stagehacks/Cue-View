/* eslint-disable class-methods-use-this */
class Cue {
  constructor(args) {
    this.uid = args[1];
    this.label = args[2];
    this.uptimeDuration = args[3];
    this.uptimeDelay = args[4];
    this.downtimeDuration = args[5];
    this.downtimeDelay = args[6];
    this.focusTimeDuration = args[7];
    this.focusTimeDelay = args[8];
    this.colorTimeDuration = args[9];
    this.colorTimeDelay = args[10];
    this.beamTimeDuration = args[11];
    this.beamTimeDelay = args[12];
    this.mark = args[16];
    this.block = args[17];
    this.assert = args[18];
    this.follow = args[20];
    this.hang = args[21];
    this.partCount = args[26];
    this.scene = args[28];
    this.duration = Math.max(args[3], args[5], args[7], args[9], args[11]);
  }

  prettyDuration(milliseconds, box) {
    if (milliseconds === -1) {
      return '';
    }

    const num = Math.round(milliseconds / 100) / 10;
    if (box) {
      return `<div class="time">${num}</div>`;
    }

    return num;
  }
}

module.exports = Cue;
