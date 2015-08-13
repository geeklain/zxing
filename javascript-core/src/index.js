import Uint8RGBLuminanceSource from './Uint8RGBLuminanceSource';
import GlobalHistogramBinarizer from './common/GlobalHistogramBinarizer';
import BinaryBitmap from './BinaryBitmap';
import Code128Reader from './oned/Code128Reader';

function processImage(imgSrc) {
  const img = new Image();
  const promise = new Promise(function (resolve, reject) {
    img.addEventListener('load', function () {
      const t0 = performance.now();

      const width = img.width;
      const height = img.height;

      var canvas = document.createElement('canvas');
      canvas.style.width = width + 'px';
      canvas.width = width;
      canvas.style.height = height + 'px';
      canvas.height = height;
      //document.body.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height);

      const pixels = ctx.getImageData(0, 0, width, height).data;

      const luminanceSource = new Uint8RGBLuminanceSource(width, height, pixels);
      const binarizer = new GlobalHistogramBinarizer(luminanceSource);
      const binaryBitmap = new BinaryBitmap(binarizer);
      const reader = new Code128Reader();

      try {
        const result = reader.decode(binaryBitmap);
        const t1 = performance.now();

        /*eslint-disable no-console */
        console.log('time: ' + (t1 - t0) + 'ms');
        console.log(result.getText());
        /*eslint-enable no-console */

        resolve(result.getText());

      } catch (e) {
        /*eslint-disable no-console */
        console.error(e);
        /*eslint-enable no-console */
        reject(e);
      }

    }, false);
  });

  img.src = imgSrc;
  return promise;
}

function processLocalImage() {
  const URL = window.URL || window.webkitURL;
  const f = document.getElementById('uploadimage').files[0];
  const imgSrc = URL.createObjectURL(f);
  processImage(imgSrc)
    .then(function (code) {
            const p = document.createElement('p');
            p.innerHTML = 'Code found: ' + code;
            document.body.appendChild(p);
          })
    .catch(function (e) {
            const p = document.createElement('p');
            p.innerHTML = 'Code not found: ' + e ;
            document.body.appendChild(p);
          });
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('uploadimage').addEventListener('change', processLocalImage, false);
});



