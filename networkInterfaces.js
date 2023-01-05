const SEARCH = require('./src/search.js');

window.init = function init() {
  const networkInterfaces = SEARCH.getNetworkInterfaces();
  let html = '';

  for (let i = 0; i < Object.keys(networkInterfaces).length; i++) {
    const interfaceID = Object.keys(networkInterfaces)[i];
    const interfaceObj = networkInterfaces[interfaceID];
    console.log(interfaceObj);

    html += `<tr><td><span class="if-${interfaceID.substring(0, 2)}">${interfaceID}</span></td>`;
    html += `<td>${interfaceObj[0].address}</td>`;
    html += `<td>${interfaceObj[0].netmask}</td>`;
    html += `<td>${interfaceObj[0].firstSearchAddress} - ${interfaceObj[0].lastSearchAddress}</td>`;
    html += `</tr>`;

    document.getElementById('network-interfaces').innerHTML = html;
  }
};
