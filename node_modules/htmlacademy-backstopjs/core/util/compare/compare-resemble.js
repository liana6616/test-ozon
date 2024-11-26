const resemble = require('@mirzazeyrek/node-resemble-js');
const sharp = require('sharp');
const { promises: { rename } } = require('fs');

const white = { r: 255, g: 255, b: 255 };
const opaque = { alpha: 1 };

const resizeByOrigin = async (reference, test) => {
  const refImg = sharp(reference);
  const testImg = sharp(test);

  const refMeta = await refImg.metadata();
  const testMeta = await testImg.metadata();

  const { width: refWidth, height: refHeight } = refMeta;
  const { width: testWidth, height: testHeight } = testMeta;

  const width = Math.min(refWidth, testWidth);
  const height = Math.min(refHeight, testHeight);

  const background = { ...white, ...opaque };

  await sharp({
    create: {
      width: refWidth,
      height: refHeight,
      channels: 4,
      background
    }
  })
    .composite([
      {
        input: await (testImg.extract({
          top: 0, left: 0, width, height
        }).toBuffer()),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toFile(test + '.resized');

  return await rename(test + '.resized', test);
};

module.exports = function (referencePath, testPath, misMatchThreshold, resembleOutputSettings, requireSameDimensions) {
  return new Promise(function (resolve, reject) {
    resizeByOrigin(referencePath, testPath).then(() => {
      const resembleSettings = resembleOutputSettings || {};
      resemble.outputSettings(resembleSettings);
      const comparison = resemble(referencePath).compareTo(testPath);

      if (resembleSettings.ignoreAntialiasing) {
        comparison.ignoreAntialiasing();
      }

      comparison.onComplete(data => {
        const misMatchPercentage = resembleSettings.usePreciseMatching ? data.rawMisMatchPercentage : data.misMatchPercentage;
        if ((requireSameDimensions === false || data.isSameDimensions === true) && misMatchPercentage <= misMatchThreshold) {
          return resolve(data);
        }
        reject(data);
      });
    });
  });
};
