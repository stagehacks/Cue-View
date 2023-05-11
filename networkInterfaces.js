const SEARCH = require('./src/search.js');

window.init = function init() {
  const networkInterfaces = SEARCH.getNetworkInterfaces();
  let html = '';

  for (let i = 0; i < Object.keys(networkInterfaces).length; i++) {
    const interfaceID = Object.keys(networkInterfaces)[i];
    const interfaceObj = networkInterfaces[interfaceID];

    html += `
      <tr>
        <td><span class="if-${interfaceID.substring(0, 2)}">${interfaceID}</span></td>
        <td>${interfaceObj[0].address}</td>
        <td>${interfaceObj[0].netmask}</td>
    `;

    if (interfaceObj[0].searchTruncated) {
      html += `<td class='red'>`;
    } else {
      html += `<td class='green'>`;
    }

    html += `
      ${interfaceObj[0].firstSearchAddress} - ${interfaceObj[0].lastSearchAddress}</td>
      </tr>
    `;

    document.getElementById('network-interfaces').innerHTML = html;
  }
};
