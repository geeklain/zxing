import Uint8RGBLuminanceSource from './Uint8RGBLuminanceSource';
import GlobalHistogramBinarizer from './common/GlobalHistogramBinarizer';
import BinaryBitmap from './BinaryBitmap';
import BarcodeFormat from './BarcodeFormat';

import Reader from './oned/ITFReader';
import Writer from './oned/ITFWriter';
const FORMAT = BarcodeFormat.ITF;

import EncodeHintType from './EncodeHintType';
import DecodeHintType from './DecodeHintType';

let container;

function processImage(imgSrc) {
  const img = new Image();
  const promise = new Promise(function (resolve, reject) {
    img.addEventListener('load', function () {
      const t0 = performance.now();

      const width = img.width;
      const height = img.height;

      const canvas = document.createElement('canvas');
      canvas.style.width = width + 'px';
      canvas.width = width;
      canvas.style.height = height + 'px';
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height);

      const pixels = ctx.getImageData(0, 0, width, height).data;

      const luminanceSource = new Uint8RGBLuminanceSource(width, height, pixels);
      const binarizer = new GlobalHistogramBinarizer(luminanceSource);
      const binaryBitmap = new BinaryBitmap(binarizer);
      const reader = new Reader();

      try {
        const hints = {};
        //hints[DecodeHintType.PURE_BARCODE] = true;
        hints[DecodeHintType.TRY_HARDER] = true;
        const result = reader.decode(binaryBitmap, hints);
        const t1 = performance.now();

        /*eslint-disable no-console */
        console.log('time: ' + (t1 - t0) + 'ms');
        console.log(result.getText());
        /*eslint-enable no-console */

        resolve(result.getText());

      } catch (e) {
        /*eslint-disable no-console */
        console.error(e, e.stack);
        /*eslint-enable no-console */
        reject(e);
      }

    }, false);
  });

  img.src = imgSrc;
  return promise;
}

function processLocalImage(e) {
  const URL = window.URL || window.webkitURL;
  const f = e.target.files[0];
  const imgSrc = URL.createObjectURL(f);
  processImage(imgSrc)
    .catch(function (e) {
            const p = document.createElement('p');
            p.innerHTML = 'Code not found: ' + e;
            container.insertBefore(p, container.firstChild);
          })
    .then(function (code) {
            processText(code);
          })
    .catch(function (e) {
            /*eslint-disable no-console */
            console.error(e, e.stack);
            /*eslint-enable no-console */
          });
}

function writeMatrixToCanvas(matrix) {
  let width = matrix.getWidth();
  let height = matrix.getHeight();

  const canvas = document.createElement('canvas');
  canvas.style.width = width + 'px';
  canvas.width = width;
  canvas.style.height = height + 'px';
  canvas.height = height;
  container.insertBefore(canvas, container.firstChild);
  const ctx = canvas.getContext('2d');

  const id = ctx.createImageData(width, height);
  const data = id.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = matrix.get(x, y);
      const colValue = bit ? 0 : 255;
      const pos = 4 * (x + y * width);
      data[pos] = colValue;
      data[pos + 1] = colValue;
      data[pos + 2] = colValue;
      data[pos + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);

  const dataURL = canvas.toDataURL();
  processImage(dataURL)
    .catch(function (e) {
            const p = document.createElement('p');
            p.innerHTML = 'Code not found: ' + e;
            container.insertBefore(p, container.firstChild);
          })
    .then(function (code) {
            const p = document.createElement('p');
            p.innerHTML = 'Code found: ' + code;
            container.insertBefore(p, container.firstChild);
          })
    .catch(function (e) {
            /*eslint-disable no-console */
            console.error(e, e.stack);
            /*eslint-enable no-console */
          });
}

function doRandomTest() {

  //const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-';
  const possible = '0123456789';
  const result = [];

  let length = 12;
  for (var i = 0; i < length; i++) {
    result.push(possible.charAt(Math.floor(Math.random() * possible.length)));
  }
  
  length++;
  let sum = 0;
  for (let i = length - 2; i >= 0; i -= 2) {
    const digit = Number.parseInt(result[i]);
    sum += digit;
  }
  sum *= 3;
  for (let i = length - 3; i >= 0; i -= 2) {
    const digit = Number.parseInt(result[i]);
    sum += digit;
  }
  result.push((10 - (sum % 10)) % 10);

  const randomStr = result.join('');
  processText(randomStr);
}

function processInputText(e) {
  processText(e.target.value);
}

function processText(text) {
  if (!text) {
    return;
  }
  
  const p = document.createElement('p');
  p.innerHTML = 'Code: ' + text;
  container.insertBefore(p, container.firstChild);

  const hints = {};
  hints[EncodeHintType.MARGIN] = 10;
  const bitMatrix = new Writer().encode(text, FORMAT, 300, 100, hints);

  writeMatrixToCanvas(bitMatrix);
}

document.addEventListener('DOMContentLoaded', function () {
  container = document.getElementById('container');
  document.getElementById('uploadImage').addEventListener('change', processLocalImage, false);
  document.getElementById('textInput').addEventListener('keyup', processInputText, false);
  document.getElementById('randomTest').addEventListener('click', doRandomTest, false);
});



