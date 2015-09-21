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
 * @author satorux@google.com (Satoru Takabayashi) - creator
 * @author dswitkin@google.com (Daniel Switkin) - ported from C++
 */
export default class QRCode {

  constructor() {
    this.maskPattern = -1;
  }

  getMode() {
    return this.mode;
  }

  getECLevel() {
    return this.ecLevel;
  }

  getVersion() {
    return this.version;
  }

  getMaskPattern() {
    return this.maskPattern;
  }

  getMatrix() {
    return this.matrix;
  }

  toString() {
    const result = new Array(200);
    result.push('<<\n');
    result.push(' this.mode: ');
    result.push(this.mode);
    result.push('\n this.ecLevel: ');
    result.push(this.ecLevel);
    result.push('\n this.version: ');
    result.push(this.version);
    result.push('\n this.maskPattern: ');
    result.push(this.maskPattern);
    if (this.matrix == null) {
      result.push('\n this.matrix: null\n');
    }
    else {
      result.push('\n this.matrix:\n');
      result.push(this.matrix);
    }
    result.push('>>\n');
    return result.join('');
  }

  setMode(value) {
    this.mode = value;
  }

  setECLevel(value) {
    this.ecLevel = value;
  }

  setVersion(version) {
    this.version = version;
  }

  setMaskPattern(value) {
    this.maskPattern = value;
  }

  setMatrix(value) {
    this.matrix = value;
  }

  // Check if "mask_pattern" is valid.
  static isValidMaskPattern(maskPattern) {
    return maskPattern >= 0 && maskPattern < QRCode.NUM_MASK_PATTERNS;
  }

}

QRCode.NUM_MASK_PATTERNS = 8;

