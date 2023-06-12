const { ipcRenderer } = require('electron');
const DEVICE = require('./device.js');
const PLUGINS = require('./plugins.js');
const { saveAll } = require('./saveSlots.js');

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

  const str = `
    <html>
      <head>
        <link href='./plugins/${d.type}/styles.css' rel='stylesheet' type='text/css'>

        <!--scrollbar styles are inline to prevent the styles flickering in-->
        <style>
            ::-webkit-scrollbar {background-color: black;width: 12px;}
            ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner {background-color: #2b2b2b;}
            ::-webkit-scrollbar-thumb {background-color: #6b6b6b;border-radius: 16px;border: 3px solid #2b2b2b;}
            ::-webkit-scrollbar-button {display:none;}
            body{visibility: hidden;}
        </style>
        <link href='src/assets/css/plugin_default.css' rel='stylesheet' type='text/css'>
      </head>
      <body>
        ${generateBodyHTML(d)}
      </body>
    </html>
  `;

  $deviceDrawArea.setAttribute('class', `${d.type} draw-area`);
  $deviceDrawArea.contentWindow.document.open();
  $deviceDrawArea.contentWindow.document.write(str);
  $deviceDrawArea.contentWindow.document.close();
  $deviceDrawArea.contentWindow.document.onclick = function (e) {
    switchDevice(d.id);
  };

  if (d.pinIndex) {
    $devicePinned.style.display = 'block';
  } else {
    $devicePinned.style.display = 'none';
  }

  return true;
}

function generateBodyHTML(d) {
  if (d.status === 'ok') {
    try {
      return PLUGINS.all[d.type].template({
        templates: d.templates,
        data: d.data,
        listName: d.displayName || d.defaultName,
      });
    } catch (err) {
      console.log(err);
      return '<h3>Plugin Template Error</h3>';
    }
  } else {
    return `
      <header>
        <h1>${d.displayName || d.defaultName}</h1>
      </header>

      <div class='not-responding'>
        <h2><em>${d.type}</em> is not responding to requests for data.</h2>
        <h3>IP <em>${d.addresses[0]}</em></h3>
        <h3>Port <em>${d.port}</em></h3>
        <hr>
      </div>
      <div class="device-info">
        ${PLUGINS.all[d.type].info()}
      </div>
    `;
  }
}

module.exports.draw = function draw(device) {
  const d = device;
  const $deviceDrawArea = document.getElementById(`device-${d.id}-draw-area`);

  if ($deviceDrawArea) {
    const scriptEl = $deviceDrawArea.contentWindow.document.createRange().createContextualFragment(generateBodyHTML(d));
    $deviceDrawArea.contentWindow.document.body.replaceChildren(scriptEl);
  } else {
    drawDeviceFrame(d.id);
  }
  d.drawn = true;
};

module.exports.update = function update(device, type, data) {
  const doc = document.getElementById(`device-${device.id}-draw-area`);
  if (doc) {
    PLUGINS.all[device.type].update(device, doc.contentWindow.document, type, data);
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

  html += `
    <div class='type'><img height='18px' src='plugins/${d.type}/icon.png'></div>
    <div class='name'>${d.displayName || d.defaultName}</div>
  `;

  const elem = document.getElementById(d.id);
  if (elem == null) {
    document
      .getElementById('device-list')
      .insertAdjacentHTML('beforeend', `<a class='device' id='${d.id}'>${html}</a>`);
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
  if (pinnedDevices.includes(activeDevice) || id === undefined) {
    cols--;
  }

  document.getElementById('all-devices').style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  if (id === undefined) {
    document.getElementById('refresh-device-button').disabled = true;
    document.getElementById('device-settings-table').style.display = 'none';
    return;
  }

  document.getElementById('refresh-device-button').disabled = false;

  const i = DEVICE.all[id].id;
  const $deviceWrapper = document.getElementById(`device-${i}`);

  if (!$deviceWrapper) {
    let html = `<div class="col device-wrapper" id="device-${i}">`;
    html += `<img id="device-${i}-pinned" class="device-pin" src="src/assets/img/outline_push_pin_white_18dp.png">`;
    html += `<img id="device-${i}-traffic" class="device-traffic-signal" src="src/assets/img/outline_link_white_18dp.png">`;
    html += `<iframe id="device-${i}-draw-area" class="draw-area"></iframe></div>`;
    document.getElementById('all-devices').insertAdjacentHTML('afterbegin', html);
  }

  window.switchClass(document.getElementById(id), 'active-device');
  drawDeviceFrame(id);
  window.switchClass(document.getElementById(`device-${id}`), 'active-device-outline');

  document.getElementById('device-settings-table').style.display = 'block';
  document.getElementById('device-settings-plugin-dropdown').value = activeDevice.type;
  document.getElementById('device-settings-name').value = activeDevice.displayName || activeDevice.defaultName || '';
  document.getElementById('device-settings-ip').value = activeDevice.addresses[0] || '';
  document.getElementById('device-settings-port').value = activeDevice.port || '';
  document.getElementById('device-settings-pin').checked = activeDevice.pinIndex;

  if (activeDevice.plugin.config.mayChangePort) {
    document.getElementById('device-settings-port').disabled = false;
  } else {
    document.getElementById('device-settings-port').disabled = true;
  }

  updateFields();

  ipcRenderer.send('enableDeviceDropdown', '');
  ipcRenderer.send('setDevicePin', !DEVICE.all[id].pinIndex === false);
}
module.exports.switchDevice = switchDevice;

function updateFields() {
  document.getElementById('device-settings-fields').innerHTML = '';

  if (activeDevice && activeDevice.plugin.config.fields) {
    const fields = activeDevice.plugin.config.fields;

    fields.forEach((field) => {
      // generic input setup
      const $elem = document.createElement('input');
      $elem.value = activeDevice.fields[field.key];
      $elem.name = field.key;
      $elem.onchange = function onchange(e) {
        activeDevice.fields[field.key] = $elem.value;
        field.action(activeDevice);
        saveAll();
      };

      // type specific setup
      if (field.type === 'textinput') {
        $elem.type = 'text';
        const rowHTML = `<tr><th>${field.label}:</th><td colspan="3" id="${field.key}"></td></tr>`;
        document.getElementById('device-settings-fields').insertAdjacentHTML('beforeend', rowHTML);
        document.getElementById(field.key).appendChild($elem);
      }
    });
  }
}
module.exports.updateFields = updateFields;

module.exports.getActiveDevice = function getActiveDevice() {
  return activeDevice;
};

module.exports.pinActiveDevice = function pinActiveDevice() {
  if (activeDevice === undefined) {
    return;
  }
  if (!pinnedDevices.includes(DEVICE.all[activeDevice.id])) {
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
    document.querySelector('#device-list .active-device').classList.remove('active-device');
  } catch (err) {
    //
  }
  document.getElementById('all-devices').innerHTML = '';
};

module.exports.getPinnedDevices = function getPinnedDevices() {
  return pinnedDevices;
};

module.exports.toggleSlotButtons = function toggleSlotButtons(slotIndex) {
  // remove all currently active classes
  const currentActiveSlots = document.getElementsByClassName('active');
  for (let i = 0; i < currentActiveSlots.length; i++) {
    const slotButton = currentActiveSlots[i];
    slotButton.classList.remove('active');
  }
  // add the active class to the newly selected slot
  document.getElementById(`save-slot-${slotIndex}`).classList.add('active');
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
  const prevIndex = Math.min(keys.length - 1, keys.indexOf(activeDevice.id) + 1);
  switchDevice(keys[prevIndex]);
};

module.exports.trafficSignal = function trafficSignal(device) {
  document.querySelector(`#device-${device.id} .device-traffic-signal`).style.opacity = 1;
  setTimeout(() => {
    document.querySelector(`#device-${device.id} .device-traffic-signal`).style.opacity = 0.3;
  }, 50);
};

function populatePluginLists() {
  let typeSelect = '';
  let addSelect = '<option value="" disabled selected hidden>&nbsp;+&nbsp;</option>';

  Object.keys(PLUGINS.all).forEach((pluginType) => {
    const plugin = PLUGINS.all[pluginType];
    addSelect += `<option value='${pluginType}'>${plugin.config.defaultName}</option>`;
    typeSelect += `<option value='${pluginType}'>${plugin.config.defaultName}</option>`;
  });

  document.getElementById('device-settings-plugin-dropdown').innerHTML = typeSelect;
  document.getElementById('add-device-button').innerHTML = addSelect;
}
