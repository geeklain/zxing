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

import {default as UPCEANReader, L_PATTERNS, MIDDLE_PATTERN} from './UPCEANReader';

import BarcodeFormat from '../BarcodeFormat';

/**
 * <p>Implements decoding of the EAN-8 format.</p>
 *
 * @author Sean Owen
 */
export default class EAN8Reader extends UPCEANReader {

  constructor() {
    super();
    this.decodeMiddleCounters = new Int32Array(4);
  }

  decodeMiddle(row, startRange, result) {
    const counters = this.decodeMiddleCounters;
    counters[0] = 0;
    counters[1] = 0;
    counters[2] = 0;
    counters[3] = 0;
    const end = row.getSize();
    let rowOffset = startRange[1];

    for (let x = 0; x < 4 && rowOffset < end; x++) {
      const bestMatch = EAN8Reader.decodeDigit(row, counters, rowOffset, L_PATTERNS);
      result.push(String.fromCharCode(48 + bestMatch));
      counters.forEach((counter) => {
        rowOffset += counter;
      });
    }

    const middleRange = EAN8Reader.findGuardPattern(row, rowOffset, true, MIDDLE_PATTERN);
    rowOffset = middleRange[1];

    for (let x = 0; x < 4 && rowOffset < end; x++) {
      const bestMatch = EAN8Reader.decodeDigit(row, counters, rowOffset, L_PATTERNS);
      result.push(String.fromCharCode(48 + bestMatch));
      counters.forEach((counter) => {
        rowOffset += counter;
      });
    }

    return rowOffset;
  }

  getBarcodeFormat() {
    return BarcodeFormat.EAN_8;
  }

}
