const notarize = require('@electron/notarize');
const fs = require('fs');
const path = require('path');

module.exports = async function (params) {
  if (process.platform !== 'darwin') {
    console.log('Only need to notarize MacOS, skipping');
    return;
  }

  const appId = 'com.stagehacks.cueview';

  const appPath = path.join(
    params.appOutDir,
    `${params.packager.appInfo.productFilename}.app`
  );

  if (!fs.existsSync(appPath)) {
    console.error('App file not found skipping notarization.');
    return;
  }

  if (
    process.env.APPLE_ID === undefined ||
    process.env.APPLE_ID_PASSWORD === undefined
  ) {
    console.log('Apple ID and Password must be set in order to notarize.');
    return;
  }

  try {
    console.log(`Notarizing ${appId} found at ${appPath}`);
    await notarize.notarize({
      appBundleId: appId,
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
    });
    console.log(`Done notarizing ${appId}`);
  } catch (error) {
    console.log('There was an error notarizing.');
    console.error(error);
  }
};
