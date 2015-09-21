/*
 * Copyright 2008 ZXing authors
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

/**
 * JAVAPORT: The original code was a 2D array of ints, but since it only ever gets assigned
 * -1, 0, and 1, I'm going to use less memory and go with bytes.
 *
 * @author dswitkin@google.com (Daniel Switkin)
 */
export default class ByteMatrix {

  constructor(width, height) {
    this.bytes = new Array(height);
    for (let i = 0; i < height; i++) {
      this.bytes[i] = new Int8Array(width);
    }
    this.width = width;
    this.height = height;
  }

  getHeight() {
    return this.height;
  }

  getWidth() {
    return this.width;
  }

  get(x, y) {
    return this.bytes[y][x];
  }

  /**
   * @return an internal representation as bytes, in row-major order. array[y][x] represents point (x,y)
   */
  getArray() {
    return this.bytes;
  }

  set(x, y, value) {
    this.bytes[y][x] = 0 + value;
  }

  clear(value) {
    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < this.width; ++x) {
        this.bytes[y][x] = value;
      }
    }
  }

  toString() {
    const result = new Array(this.width * this.height + 1);
    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < this.width; ++x) {
        switch (this.bytes[y][x]) {
          case 0:
            result.append(' 0');
            break;
          case 1:
            result.append(' 1');
            break;
          default:
            result.append('  ');
            break;
        }
      }
      result.append('\n');
    }
    return result.join('');
  }

}
