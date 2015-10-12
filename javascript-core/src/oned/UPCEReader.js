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

import {default as UPCEANReader, L_AND_G_PATTERNS} from './UPCEANReader';

import BarcodeFormat from '../BarcodeFormat';

import NotFoundException from '../NotFoundException';

/**
 * The pattern that marks the middle, and end, of a UPC-E pattern.
 * There is no "second half" to a UPC-E barcode.
 */
const MIDDLE_END_PATTERN = Object.freeze([1, 1, 1, 1, 1, 1]);

/**
 * See {@link #L_AND_G_PATTERNS}; these values similarly represent patterns of
 * even-odd parity encodings of digits that imply both the number system (0 or 1)
 * used, and the check digit.
 */
const NUMSYS_AND_CHECK_DIGIT_PATTERNS = Object.freeze([
  Object.freeze([0x38, 0x34, 0x32, 0x31, 0x2C, 0x26, 0x23, 0x2A, 0x29, 0x25]),
  Object.freeze([0x07, 0x0B, 0x0D, 0x0E, 0x13, 0x19, 0x1C, 0x15, 0x16, 0x1A])
]);


/**
 * <p>Implements decoding of the UPC-E format.</p>
 * <p><a href="http://www.barcodeisland.com/upce.phtml">This</a> is a great reference for
 * UPC-E information.</p>
 *
 * @author Sean Owen
 */
export default class UPCEReader extends UPCEANReader {

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

    let lgPatternFound = 0;

    for (let x = 0; x < 6 && rowOffset < end; x++) {
      const bestMatch = UPCEReader.decodeDigit(row, counters, rowOffset, L_AND_G_PATTERNS);
      result.push(String.fromCharCode(48 + bestMatch % 10));
      counters.forEach((counter) => {
        rowOffset += counter;
      });
      if (bestMatch >= 10) {
        lgPatternFound |= 1 << (5 - x);
      }
    }

    UPCEReader.determineNumSysAndCheckDigit(result, lgPatternFound);

    return rowOffset;
  }

  decodeEnd(row, endStart) {
    return UPCEReader.findGuardPattern(row, endStart, true, MIDDLE_END_PATTERN);
  }

  checkChecksum(s) {
    return super.checkChecksum(UPCEReader.convertUPCEtoUPCA(s));
  }

  static determineNumSysAndCheckDigit(resultString, lgPatternFound) {

    for (let numSys = 0; numSys <= 1; numSys++) {
      for (let d = 0; d < 10; d++) {
        if (lgPatternFound === NUMSYS_AND_CHECK_DIGIT_PATTERNS[numSys][d]) {

          resultString.unshift(String.fromCharCode(48 + numSys));
          resultString.push(String.fromCharCode(48 + d));
          return;
        }
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  getBarcodeFormat() {
    return BarcodeFormat.UPC_E;
  }

  /**
   * Expands a UPC-E value back into its full, equivalent UPC-A code value.
   *
   * @param upce UPC-E code as string of digits
   * @return equivalent UPC-A code as string of digits
   */
  static convertUPCEtoUPCA(upce) {

    const upceChars = upce.substring(1, 7);
    const result = [];
    result.push(upce.charAt(0));
    const lastChar = upceChars.charAt(5);
    switch (lastChar) {
      case '0':
      case '1':
      case '2':
        result.push(upceChars.substring(0, 2));
        result.push(lastChar);
        result.push('0000');
        result.push(upceChars.substring(2, 3));
        break;
      case '3':
        result.push(upceChars.substring(0, 3));
        result.push('00000');
        result.push(upceChars.substring(3, 2));
        break;
      case '4':
        result.push(upceChars.substring(0, 4));
        result.push('00000');
        result.push(upceChars.charAt(4));
        break;
      default:
        result.push(upceChars.substring(0, 5));
        result.push('0000');
        result.push(lastChar);
        break;
    }
    result.push(upce.charAt(7));
    return result.join('');
  }

}
