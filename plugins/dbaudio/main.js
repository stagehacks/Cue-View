exports.config = {
  defaultName: 'd&b Amps',
  connectionType: 'TCPsocket',
  defaultPort: 30013,
  mayChangePort: false,
  heartbeatInterval: 1000,
  heartbeatTimeout: 5000,
  searchOptions: {
    type: 'Bonjour',
    bonjourName: 'oca',
    validateResponse(msg, info) {
      return msg.includes('d&b audiotechnik');
    },
  },
};

let ocaIDs = [];

exports.ready = function ready(_device) {
  const device = _device;

  device.data.oca = {
    ModelDescription: {
      target: 0x1000010d,
      method: 0x00050001,
      format: 'string',
    },
    PwrOn: {
      target: 0x10000100,
      method: 0x00040001,
      format: 'int16',
    },
    SubNet: {
      target: 0x10000109,
      method: 0x00050001,
      format: 'int32',
    },
    DeviceId: {
      target: 0x10000108,
      method: 0x00050001,
      format: 'int32',
    },
    DeviceType: {
      target: 0x10000034,
      method: 0x00050001,
      format: 'string',
    },
    FirmwareRevision: {
      target: 0x10000031,
      method: 0x00050001,
      format: 'string',
    },
    ChannelNameA: {
      target: 0x10008215,
      method: 0x00050001,
      format: 'string',
    },
    ChannelNameB: {
      target: 0x10010215,
      method: 0x00050001,
      format: 'string',
    },
    ChannelNameC: {
      target: 0x10018215,
      method: 0x00050001,
      format: 'string',
    },
    ChannelNameD: {
      target: 0x10020215,
      method: 0x00050001,
      format: 'string',
    },
    DelayA: {
      target: 0x10008207,
      method: 0x00050001,
      format: 'float',
    },
    DelayB: {
      target: 0x10010207,
      method: 0x00050001,
      format: 'float',
    },
    DelayC: {
      target: 0x10018207,
      method: 0x00050001,
      format: 'float',
    },
    DelayD: {
      target: 0x10020207,
      method: 0x00050001,
      format: 'float',
    },
    InputEnable1A: {
      target: 0x10008220,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable2A: {
      target: 0x10008221,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable3A: {
      target: 0x10008222,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable4A: {
      target: 0x10008223,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable5A: {
      target: 0x10008224,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable6A: {
      target: 0x10008225,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable7A: {
      target: 0x10008226,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable8A: {
      target: 0x10008227,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable1B: {
      target: 0x10010220,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable2B: {
      target: 0x10010221,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable3B: {
      target: 0x10010222,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable4B: {
      target: 0x10010223,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable5B: {
      target: 0x10010224,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable6B: {
      target: 0x10010225,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable7B: {
      target: 0x10010226,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable8B: {
      target: 0x10010227,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable1C: {
      target: 0x10018220,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable2C: {
      target: 0x10018221,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable3C: {
      target: 0x10018222,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable4C: {
      target: 0x10018223,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable5C: {
      target: 0x10018224,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable6C: {
      target: 0x10018225,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable7C: {
      target: 0x10018226,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable8C: {
      target: 0x10018227,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable1D: {
      target: 0x10020220,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable2D: {
      target: 0x10020221,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable3D: {
      target: 0x10020222,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable4D: {
      target: 0x10020223,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable5D: {
      target: 0x10020224,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable6D: {
      target: 0x10020225,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable7D: {
      target: 0x10020226,
      method: 0x00040001,
      format: 'int16',
    },
    InputEnable8D: {
      target: 0x10020227,
      method: 0x00040001,
      format: 'int16',
    },
    InputGainA: {
      target: 0x10008206,
      method: 0x00040001,
      format: 'float',
    },
    InputGainB: {
      target: 0x10010206,
      method: 0x00040001,
      format: 'float',
    },
    InputGainC: {
      target: 0x10018206,
      method: 0x00040001,
      format: 'float',
    },
    InputGainD: {
      target: 0x10020206,
      method: 0x00040001,
      format: 'float',
    },
    SpeakerIDA: {
      target: 0x10008214,
      method: 0x00040001,
      format: 'int16',
    },
    SpeakerIDB: {
      target: 0x10010214,
      method: 0x00040001,
      format: 'int16',
    },
    SpeakerIDC: {
      target: 0x10018214,
      method: 0x00040001,
      format: 'int16',
    },
    SpeakerIDD: {
      target: 0x10020214,
      method: 0x00040001,
      format: 'int16',
    },
    SpeakerIDList: {
      target: 0x10010214,
      method: 0x00040005,
      format: 'stringArray',
    },
    OutputMode: {
      target: 0x10000111,
      method: 0x00040001,
      format: 'int16',
    },
    OutputModeList: {
      target: 0x10000111,
      method: 0x00040005,
      format: 'stringArray',
    },
    MuteA: {
      target: 0x10008205,
      method: 0x00040001,
      format: 'int8',
    },
    MuteB: {
      target: 0x10010205,
      method: 0x00040001,
      format: 'int8',
    },
    MuteC: {
      target: 0x10018205,
      method: 0x00040001,
      format: 'int8',
    },
    MuteD: {
      target: 0x10020205,
      method: 0x00040001,
      format: 'int8',
    },
  };

  const ocaKeys = Object.keys(device.data.oca);
  ocaIDs = [];
  for (let i = 0; i < ocaKeys.length; i++) {
    const key = device.data.oca[ocaKeys[i]];
    key.parameters = [0];
    ocaIDs[i] = key;
    ocaCommandRequest(i, key.target, key.method, device);
    ocaSubscriptionRequest(i, key.target, key.method, device);
  }
  console.log(device.data.oca);
};

exports.data = function data(_device, _buffer) {
  if (_buffer[0] === 0x3b && _buffer[1] === 0 && _buffer[2] === 1) {
    let start = 0;
    while (start < _buffer.length - 3) {
      const messageLength = _buffer.readInt32BE(start + 3) + 1;
      const message = _buffer.slice(start, start + messageLength);

      const messageType = message[7];

      if (messageType === 0x04) {
        // keep-alive message
      } else if (messageType === 0x02) {
        // console.log('NOTIFICATION!!');
        console.log(message.slice(33));
      } else if (messageType === 0x03) {
        const messageHandle = _buffer.readInt32BE(start + 14);
        const paramCount = message[19];

        if (paramCount) {
          let paramsStart = 20;

          ocaIDs[messageHandle].parameters = [];

          while (paramsStart < message.length) {
            let paramLength = 0;
            let param;

            if (
              ocaIDs[messageHandle].format === 'int16' ||
              ocaIDs[messageHandle].format === 'float' ||
              ocaIDs[messageHandle].format === 'int32'
            ) {
              paramLength = 2;
              param = message.slice(paramsStart, paramsStart + paramLength + 2);
            } else if (ocaIDs[messageHandle].format === 'int8') {
              paramLength = 1;
              param = message.slice(paramsStart, paramsStart + paramLength);
            } else if (ocaIDs[messageHandle].format === 'stringArray') {
              const nextBreak = message.indexOf(0x00, paramsStart + 1);

              if (nextBreak < 0) {
                break;
              }

              paramLength = nextBreak - paramsStart + 1;
              param = message.slice(paramsStart - 1, paramsStart + paramLength - 1).toString();
            } else {
              paramLength = message.readInt16BE(20);
              param = message.slice(paramsStart + 2, paramsStart + 2 + paramLength);
            }

            if (ocaIDs[messageHandle].format === 'string') {
              ocaIDs[messageHandle].parameters.push(param.toString());
            } else if (ocaIDs[messageHandle].format === 'stringArray') {
              ocaIDs[messageHandle].parameters.push(param.toString());
            } else if (ocaIDs[messageHandle].format === 'float') {
              ocaIDs[messageHandle].parameters.push(param.readFloatBE(0));
            } else if (ocaIDs[messageHandle].format === 'int16') {
              ocaIDs[messageHandle].parameters.push(param.readInt16BE(0));
            } else if (ocaIDs[messageHandle].format === 'int8') {
              ocaIDs[messageHandle].parameters.push(param.readInt8(0));
            } else if (ocaIDs[messageHandle].format === 'int32') {
              ocaIDs[messageHandle].parameters.push(param.readInt32BE(0));
            } else {
              ocaIDs[messageHandle].parameters.push(param);
            }

            paramsStart += paramLength + 2;
          }
        }
      }

      start += messageLength;
    }
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send(Buffer.from('3b00010000000b0400010001', 'hex'));
  device.draw();
};

function ocaCommandRequest(handle, target, method, device) {
  const buf = Buffer.from('3b00010000001a01000100000011AAAAAAAABBBBBBBBCCCCCCCC00', 'hex');
  buf.writeInt32BE(handle, 14); // handle
  buf.writeInt32BE(target, 18); // target
  buf.writeInt32BE(method, 22); // method
  device.send(buf);
  return buf;
}

function ocaSubscriptionRequest(handle, target, method, device) {
  const buf = Buffer.from(
    '3b00010000002f01000100000026000000ae00000004000300010510008205000100010000041f000100010000010000',
    'hex'
  );
  buf.writeInt32BE(handle, 14); // handle
  buf.writeInt32BE(target, 27); // target
  device.send(buf);
  return buf;
}
