/*
 * Copyright 2009 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import LuminanceSource from './LuminanceSource';
import IllegalArgumentException from './IllegalArgumentException';

/**
 * //FIXME fix doc
 * This class is used to help decode images from files which arrive as RGB data from
 * an ARGB pixel array. It does not support rotation.
 *
 * @author dswitkin@google.com (Daniel Switkin)
 * @author Betaminos
 */
export default class Uint8RGBLuminanceSource extends LuminanceSource {

  constructor(width, height, pixels, dataWidth = width, dataHeight = height, left = 0, top = 0,
              isAlreadyGreyScale = false) {
    super(width, height);

    this.dataWidth = dataWidth;
    this.dataHeight = dataHeight;
    this.left = left;
    this.top = top;

    if (isAlreadyGreyScale) {
      this.luminances = pixels;
    } else {
      // In order to measure pure decoding speed, we convert the entire image to a greyscale array
      // up front, which is the same as the Y channel of the YUVLuminanceSource in the real app.
      const length = width * height;
      this.luminances = new Uint8ClampedArray(length);
      for (let i = 0; i < length; i++) {

        const pos = i * 4;
        const r = pixels[pos];
        const g = pixels[pos + 1];
        const b = pixels[pos + 2];
        const a = pixels[pos + 3];
        
        let luminance;
        if (r === g && g === b) {
          // Image is already greyscale, so pick any channel.
          luminance = r;
        } else {
          // Calculate luminance cheaply, favoring green.
          luminance = Math.floor((r + 2 * g + b) / 4);
        }
        if (a === 0xFF) {
          this.luminances[i] = luminance;
        } else {
          // assume white background for transparent images
          this.luminances[i] = Math.floor(((luminance * a) + 0xFF * (0xFF - a)) / 0xFF);  
        }
      }
    }
  }

  getRow(y, row) {
    if (y < 0 || y >= this.getHeight()) {
      throw new IllegalArgumentException('Requested row is outside the image: ' + y);
    }
    const width = this.getWidth();
    if (!row || row.length < width) {
      row = new Uint8ClampedArray(width);
    }
    const offset = (y + this.top) * this.dataWidth + this.left;
    for (let i = 0; i < width; i++) {
      row[i] = this.luminances[offset + i];
    }

    return row;
  }

  getMatrix() {
    const width = this.getWidth();
    const height = this.getHeight();

    // If the caller asks for the entire underlying image, save the copy and give them the
    // original data. The docs specifically warn that result.length must be ignored.
    if (width === this.dataWidth && height === this.dataHeight) {
      return this.luminances;
    }

    const area = width * height;
    const matrix = new Uint8ClampedArray(area);
    let inputOffset = this.top * this.dataWidth + this.left;

    // If the width matches the full width of the underlying data, perform a single copy.
    if (width === this.dataWidth) {
      for (let i = 0; i < area; i++) {
        matrix[i] = this.luminances[inputOffset + i];
      }
      return matrix;
    }

    // Otherwise copy one cropped row at a time.
    const rgb = this.luminances;
    for (let y = 0; y < height; y++) {
      let outputOffset = y * width;
      for (let i = 0; i < width; i++) {
        matrix[outputOffset + i] = rgb[inputOffset + i];
      }
      inputOffset += this.dataWidth;
    }
    return matrix;
  }

  isCropSupported() {
    return true;
  }

  crop(left, top, width, height) {
    return new Uint8RGBLuminanceSource(width,
                                       height,
                                       this.luminances,
                                       this.dataWidth, this.dataHeight,
                                       this.left + left,
                                       this.top + top,
                                       true);
  }

}
