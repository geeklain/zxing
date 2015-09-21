/*
 * Copyright 2010 ZXing authors
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

import EAN13Writer from './EAN13Writer';

import BarcodeFormat from '../BarcodeFormat';
import IllegalArgumentException from '../IllegalArgumentException';

/**
 * This object renders a UPC-A code as a {@link BitMatrix}.
 *
 * @author qwandor@google.com (Andrew Walbran)
 */
export default class UPCAWriter {

  
  constructor() {
    this.subWriter = new EAN13Writer();
  }

  encode(contents, format, width, height, hints) {
    
    if (format !== BarcodeFormat.UPC_A) {
      throw new IllegalArgumentException('Can only encode UPC-A, but got ' + format);
    }
    return this.subWriter.encode(UPCAWriter.preencode(contents), BarcodeFormat.EAN_13, width, height, hints);
  }

  /**
   * Transform a UPC-A code into the equivalent EAN-13 code, and add a check digit if it is not
   * already present.
   */
  static preencode(contents) {
    const length = contents.length;
    if (length === 11) {
      // No check digit present, calculate it and add it
      let sum = 0;
      for (let i = 0; i < 11; ++i) {
        sum += (contents.charCodeAt(i) - 48) * (i % 2 === 0 ? 3 : 1);
      }
      contents += (1000 - sum) % 10;
    } else if (length !== 12) {
      throw new IllegalArgumentException('Requested contents should be 11 or 12 digits long, but got ' + contents.length);
    }
    return '0' + contents;
  }
}
