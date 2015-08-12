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

//import InvertedLuminanceSource from './InvertedLuminanceSource';
import UnsupportedOperationException from './UnsupportedOperationException';

/**
 * The purpose of this class hierarchy is to abstract different bitmap implementations across
 * platforms into a standard interface for requesting greyscale luminance values. The interface
 * only provides immutable methods; therefore crop and rotation create copies. This is to ensure
 * that one Reader does not modify the original luminance source and leave it in an unknown state
 * for other Readers in the chain.
 *
 * @author dswitkin@google.com (Daniel Switkin)
 */
export default class LuminanceSource {

  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * @return The width of the bitmap.
   */
  getWidth() {
    return this.width;
  }

  /**
   * @return The height of the bitmap.
   */
  getHeight() {
    return this.height;
  }

  /**
   * @return Whether this subclass supports cropping.
   */
  isCropSupported() {
    return false;
  }

  /**
   * Returns a new object with cropped image data. Implementations may keep a reference to the
   * original data rather than a copy. Only callable if isCropSupported() is true.
   *
   * @return A cropped version of this object.
   */
  crop() {
    throw new UnsupportedOperationException('This luminance source does not support cropping.');
  }

  /**
   * @return Boolean Whether this subclass supports counter-clockwise rotation.
   */
  isRotateSupported() {
    return false;
  }

  /**
   * @return InvertedLuminanceSource a wrapper of this {@code LuminanceSource} which inverts the luminances it returns
   *   -- black becomes white and vice versa, and each value becomes (255-value).
   */
  invert() {
    //return new InvertedLuminanceSource(this);
  }

  /**
   * Returns a new object with rotated image data by 90 degrees counterclockwise.
   * Only callable if {@link #isRotateSupported()} is true.
   *
   * @return A rotated version of this object.
   */
  rotateCounterClockwise() {
    throw new UnsupportedOperationException('This luminance source does not support rotation by 90 degrees.');
  }

  /**
   * Returns a new object with rotated image data by 45 degrees counterclockwise.
   * Only callable if {@link #isRotateSupported()} is true.
   *
   * @return A rotated version of this object.
   */
  rotateCounterClockwise45() {
    throw new UnsupportedOperationException('This luminance source does not support rotation by 45 degrees.');
  }

  toString() {
    let row = [];
    const result = [];
    for (let y = 0; y < this.height; y++) {
      row = this.getRow(y, row);
      for (let x = 0; x < this.width; x++) {
        const luminance = row[x] & 0xFF;
        let c;
        if (luminance < 0x40) {
          c = '#';
        } else if (luminance < 0x80) {
          c = '+';
        } else if (luminance < 0xC0) {
          c = '.';
        } else {
          c = ' ';
        }
        result.push(c);
      }
      result.push('\n');
    }
    return result.join('');
  }

}
