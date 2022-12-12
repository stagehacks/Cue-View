const { ipcRenderer } = require('electron');
const DEVICE = require('./device.js');
const PLUGINS = require('./plugins.js');
const { saveAll } = require('./saveSlots.js');
// const _ = require('lodash/function');

const pinnedDevices = [];
module.exports.pinnedDevices = pinnedDevices;
let activeDevice = false;

module.exports.init = function init() {
  populatePluginLists();
};

function drawDeviceFrame(id) {
  const $deviceDrawArea = document.getElementById(`device-${id}-draw-area`);
  const $devicePinned = document.getElementById(`device-${id}-pinned`);

  if ($deviceDrawArea == null) {
    return true;
  }

  const d = DEVICE.all[id];

  let str = '<html><head>';
  str += `<link href='./plugins/${d.type}/styles.css' rel='stylesheet' type='text/css'>`;

  // scrollbar styles are inline to prevent the styles flickering in
  str += '<style>';
  str += '::-webkit-scrollbar {background-color: black;width: 12px;}';
  str +=
    '::-webkit-scrollbar-track, ::-webkit-scrollbar-corner {background-color: #2b2b2b;}';
  str +=
    '::-webkit-scrollbar-thumb {background-color: #6b6b6b;border-radius: 16px;border: 3px solid #2b2b2b;}';
  str += '::-webkit-scrollbar-button {display:none;}';
  str += 'body{visibility: hidden;}';
  str += '</style>';
  str += "<link href='src/defaultPlugin.css' rel='stylesheet' type='text/css'>";
  str += '</head><body>';

  str += generateBodyHTML(d);

  // str += "<script src='node_modules/lodash/core.min.js'></script>";
  // str += "<script src='./plugins/" +d.type +"/update.js'></script>";

  str += '</body></html>';

  $deviceDrawArea.setAttribute('class', `${d.type} draw-area`);
  $deviceDrawArea.contentWindow.document.open();
  $deviceDrawArea.contentWindow.document.write(str);
  $deviceDrawArea.contentWindow.document.close();

  if (d.pinIndex) {
    $devicePinned.style.display = 'block';
  } else {
    $devicePinned.style.display = 'none';
  }

  return true;
}

function generateBodyHTML(d) {
  let str = '';

  if (d.status === 'ok') {
    try {
      str += PLUGINS.all[d.type].template({
        data: d.data,
        listName: d.displayName || d.defaultName,
      });
    } catch (err) {
      console.log(err);
      str += '<h3>Plugin Template Error</h3>';
    }
  } else {
    str += `<header><h1>${d.displayName || d.defaultName}</h1></header>`;
    str += "<div class='not-responding'>";
    str += `<h2><em>${d.type}</em> is not responding to requests for data.</h2>`;
    str += `<h3>IP <em>${d.addresses[0]}</em></h3>`;
    str += `<h3>Port <em>${d.port}</em></h3>`;
    str += '<hr></div>';
    str += `<div class="device-info">${PLUGINS.all[d.type].info()}<div>`;
  }

  return str;
}

module.exports.draw = function draw(device) {
  const d = device;
  const $deviceDrawArea = document.getElementById(`device-${d.id}-draw-area`);

  if ($deviceDrawArea) {
    const scriptEl = $deviceDrawArea.contentWindow.document
      .createRange()
      .createContextualFragment(generateBodyHTML(d));
    $deviceDrawArea.contentWindow.document.body.replaceChildren(scriptEl);
  } else {
    drawDeviceFrame(d.id);
  }
  d.drawn = true;
};

module.exports.update = function update(device, type, data) {
  const doc = document.getElementById(`device-${device.id}-draw-area`);
  if (doc) {
    PLUGINS.all[device.type].update(
      device,
      doc.contentWindow.document,
      type,
      data
    );
  }
};

module.exports.addDeviceToList = function addDeviceToList(device) {
  const d = device;
  let html = '';

  if (d.status === 'ok') {
    html += "<div class='status material-icons green'>done</div>";
  } else if (d.status === 'refresh') {
    html += "<div class='status material-icons'>refresh</div>";
  } else {
    html += "<div class='status material-icons red'>clear</div>";
  }

  html += `<div class='type'><img height='18px' src='plugins/${d.type}/icon.png'></div>`;
  html += `<div class='name'>${d.displayName || d.defaultName}</div>`;

  const elem = document.getElementById(d.id);
  if (elem == null) {
    document
      .getElementById('device-list')
      .insertAdjacentHTML(
        'beforeend',
        `<a class='device' id='${d.id}'>${html}</a>`
      );
  } else {
    elem.innerHTML = html;
  }
};

module.exports.removeDeviceFromList = function removeDeviceFromList(device) {
  const d = device;
  document.getElementById(d.id).remove();
};

function switchDevice(id) {
  if (activeDevice && activeDevice.pinIndex === false) {
    document.getElementById(`device-${activeDevice.id}`).remove();
    activeDevice = false;
  }
  activeDevice = DEVICE.all[id];

  let cols = 1;
  if (pinnedDevices.length > 0) {
    cols += pinnedDevices.length;
  }
  if (pinnedDevices.indexOf(activeDevice) >= 0 || id === undefined) {
    cols--;
  }

  document.getElementById(
    'all-devices'
  ).style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  if (id === undefined) {
    // document.getElementById('refresh-device-button').style.opacity = 0.2;
    document.getElementById('refresh-device-button').disabled = true;
    document.getElementById('device-settings-table').style.display = 'none';
    return;
  }

  document.getElementById('refresh-device-button').disabled = false;
  // document.getElementById('refresh-device-button').style.opacity = 1;

  const i = DEVICE.all[id].id;
  let $deviceWrapper = document.getElementById(`device-${i}`);

  if (!$deviceWrapper) {
    const html = `<div class="col device-wrapper" id="device-${i}"><img id="device-${i}-pinned" class="device-pin" src="src/img/outline_push_pin_white_18dp.png"><iframe id="device-${i}-draw-area" class="draw-area"></iframe></div>`;
    document
      .getElementById('all-devices')
      .insertAdjacentHTML('afterbegin', html);

    $deviceWrapper = document.getElementById(`device-${i}`);
  }

  window.switchClass(document.getElementById(id), 'active-device');
  drawDeviceFrame(id);
  window.switchClass(
    document.getElementById(`device-${id}`),
    'active-device-outline'
  );

  document.getElementById('device-settings-table').style.display = 'block';
  document.getElementById('device-settings-plugin-dropdown').value =
    activeDevice.type;
  document.getElementById('device-settings-name').value =
    activeDevice.displayName || activeDevice.defaultName || '';
  document.getElementById('device-settings-ip').value =
    activeDevice.addresses[0] || '';
  document.getElementById('device-settings-port').value =
    activeDevice.port || '';
  document.getElementById('device-settings-pin').checked =
    activeDevice.pinIndex;

  if (activeDevice.plugin.config.mayChangePort) {
    document.getElementById('device-settings-port').disabled = false;
  } else {
    document.getElementById('device-settings-port').disabled = true;
  }

  document.getElementById('device-settings-fields').innerHTML = '';

  if (activeDevice.plugin.config.fields) {
    let fields = activeDevice.plugin.config.fields;

    fields.forEach((field) => {
      let $elem = document.createElement('input');
      $elem.type = 'text';
      $elem.value = activeDevice.fields[field.key]; // || field.value;
      $elem.name = field.key;
      $elem.onchange = function (e) {
        activeDevice.fields[field.key] = $elem.value;
        field.action(activeDevice);
        saveAll();
      };

      if (field.type == 'textinput') {
        let rowHTML = `<tr><th>${field.label}:</th><td colspan="3" id="${field.key}"></td></tr>`;
        document
          .getElementById('device-settings-fields')
          .insertAdjacentHTML('beforeend', rowHTML);
        document.getElementById(field.key).appendChild($elem);
      }
    });
  }

  ipcRenderer.send('enableDeviceDropdown', '');
  ipcRenderer.send('setDevicePin', !DEVICE.all[id].pinIndex === false);
}
module.exports.switchDevice = switchDevice;

module.exports.getActiveDevice = function getActiveDevice() {
  return activeDevice;
};

module.exports.pinActiveDevice = function pinActiveDevice() {
  if (activeDevice === undefined) {
    return;
  }
  if (pinnedDevices.indexOf(DEVICE.all[activeDevice.id]) === -1) {
    pinnedDevices.push(DEVICE.all[activeDevice.id]);
  }
  DEVICE.changeActivePinIndex(true);
};

module.exports.unpinActiveDevice = function unpinActiveDevice() {
  if (activeDevice === undefined) {
    return;
  }
  pinnedDevices.splice(pinnedDevices.indexOf(DEVICE.all[activeDevice.id]), 1);
  DEVICE.changeActivePinIndex(false);
};

module.exports.pinDevice = function pinDevice(device) {
  pinnedDevices.push(device);
  DEVICE.changePinIndex(device, true);
};

module.exports.unpinDevice = function unpinDevice(device) {
  pinnedDevices.push(device);
  DEVICE.changePinIndex(device, false);
};

module.exports.resetPinned = function resetPinned() {
  pinnedDevices.length = 0;
  activeDevice = false;

  try {
    document
      .querySelector('#device-list .active-device')
      .classList.remove('active-device');
  } catch (err) {
    //
  }
  document.getElementById('all-devices').innerHTML = '';
};

module.exports.getPinnedDevices = function getPinnedDevices() {
  return pinnedDevices;
};

module.exports.toggleSlotButtons = function toggleSlotButtons(slotIndex) {
  if (slotIndex === 1) {
    document.getElementById('save-slot-1').classList.add('active');
    document.getElementById('save-slot-2').classList.remove('active');
    document.getElementById('save-slot-3').classList.remove('active');
  } else if (slotIndex === 2) {
    document.getElementById('save-slot-1').classList.remove('active');
    document.getElementById('save-slot-2').classList.add('active');
    document.getElementById('save-slot-3').classList.remove('active');
  } else if (slotIndex === 3) {
    document.getElementById('save-slot-1').classList.remove('active');
    document.getElementById('save-slot-2').classList.remove('active');
    document.getElementById('save-slot-3').classList.add('active');
  }
};

module.exports.selectPreviousDevice = function selectPreviousDevice() {
  if (activeDevice === undefined) {
    return;
  }
  const keys = Object.keys(DEVICE.all);
  const prevIndex = Math.max(0, keys.indexOf(activeDevice.id) - 1);
  switchDevice(keys[prevIndex]);
};

module.exports.selectNextDevice = function selectNextDevice() {
  if (activeDevice === undefined) {
    return;
  }
  const keys = Object.keys(DEVICE.all);
  const prevIndex = Math.min(
    keys.length - 1,
    keys.indexOf(activeDevice.id) + 1
  );
  switchDevice(keys[prevIndex]);
};

function populatePluginLists() {
  let typeSelect = '';
  let addSelect =
    '<option value="" disabled selected hidden>&nbsp;+&nbsp;</option>';

  Object.keys(PLUGINS.all).forEach((pluginType) => {
    const plugin = PLUGINS.all[pluginType];
    addSelect += `<option value='${pluginType}'>${plugin.config.defaultName}</option>`;
    typeSelect += `<option value='${pluginType}'>${plugin.config.defaultName}</option>`;
  });

  document.getElementById('device-settings-plugin-dropdown').innerHTML =
    typeSelect;
  document.getElementById('add-device-button').innerHTML = addSelect;
}
