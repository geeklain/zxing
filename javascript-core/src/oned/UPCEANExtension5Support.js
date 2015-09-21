/*
 * Copyright (C) 2010 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
import UPCEANReader from './UPCEANReader';

import BarcodeFormat from '../BarcodeFormat'; 
import Result from '../Result';
import ResultMetadataType from '../ResultMetadataType';
import ResultPoint from '../ResultPoint';

import NotFoundException from '../NotFoundException';

const CHECK_DIGIT_ENCODINGS = [
  0x18, 0x14, 0x12, 0x11, 0x0C, 0x06, 0x03, 0x0A, 0x09, 0x05
];

/**
 * @see UPCEANExtension2Support
 */
export default class UPCEANExtension5Support {

  constructor() {
    this.decodeMiddleCounters = new Int32Array(4);
  }

  decodeRow(rowNumber, row, extensionStartRange) {

    const result = [];
    const end = this.decodeMiddle(row, extensionStartRange, result);

    const resultString = result.join('');
    const extensionData = UPCEANExtension5Support.parseExtensionString(resultString);

    const extensionResult = new Result(
      resultString,
      null, [
        new ResultPoint((extensionStartRange[0] + extensionStartRange[1]) / 2.0, rowNumber),
        new ResultPoint(end, rowNumber)
      ],
      BarcodeFormat.UPC_EAN_EXTENSION);
    if (extensionData) {
      extensionResult.putAllMetadata(extensionData);
    }
    return extensionResult;
  }

  decodeMiddle(row, startRange, resultString) {
    const counters = this.decodeMiddleCounters;
    counters[0] = 0;
    counters[1] = 0;
    counters[2] = 0;
    counters[3] = 0;
    const end = row.getSize();
    let rowOffset = startRange[1];

    let lgPatternFound = 0;

    for (let x = 0; x < 5 && rowOffset < end; x++) {
      const bestMatch = UPCEANReader.decodeDigit(row, counters, rowOffset, UPCEANReader.L_AND_G_PATTERNS);
      resultString.push(bestMatch % 10);
      counters.forEach(function (counter) {
        rowOffset += counter;
      });
      if (bestMatch >= 10) {
        lgPatternFound |= 1 << (4 - x);
      }
      if (x !== 4) {
        // Read off separator if not last
        rowOffset = row.getNextSet(rowOffset);
        rowOffset = row.getNextUnset(rowOffset);
      }
    }

    if (resultString.length !== 5) {
      throw NotFoundException.getNotFoundInstance();
    }

    const checkDigit = UPCEANExtension5Support.determineCheckDigit(lgPatternFound);
    if (UPCEANExtension5Support.extensionChecksum(resultString.join('')) !== checkDigit) {
      throw NotFoundException.getNotFoundInstance();
    }

    return rowOffset;
  }

  static extensionChecksum(s) {
    const length = s.length;
    let sum = 0;
    for (let i = length - 2; i >= 0; i -= 2) {
      sum += parseInt(s.charAt(i));
    }
    sum *= 3;
    for (let i = length - 1; i >= 0; i -= 2) {
      sum += parseInt(s.charAt(i));
    }
    sum *= 3;
    return sum % 10;
  }

  static determineCheckDigit(lgPatternFound) {
    for (let d = 0; d < 10; d++) {
      if (lgPatternFound === CHECK_DIGIT_ENCODINGS[d]) {
        return d;
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  /**
   * @param raw raw content of extension
   * @return formatted interpretation of raw content as a {@link Map} mapping
   *  one {@link ResultMetadataType} to appropriate value, or {@code null} if not known
   */
  static parseExtensionString(raw) {
    if (raw.length != 5) {
      return null;
    }
    const value = UPCEANExtension5Support.parseExtension5String(raw);
    if (!value) {
      return null;
    }
    const result = {};
    result[ResultMetadataType.SUGGESTED_PRICE] = value;
    return result;
  }

  static parseExtension5String(raw) {
    let currency;
    switch (raw.charAt(0)) {
      case '0':
        currency = '£';
        break;
      case '5':
        currency = '$';
        break;
      case '9':
        // Reference: http://www.jollytech.com
        if ('90000'.equals(raw)) {
          // No suggested retail price
          return null;
        }
        if ('99991'.equals(raw)) {
          // Complementary
          return '0.00';
        }
        if ('99990'.equals(raw)) {
          return 'Used';
        }
        // Otherwise... unknown currency?
        currency = '';
        break;
      default:
        currency = '';
        break;
    }
    const rawAmount = parseInt(raw.substring(1));
    const floatingAmount = rawAmount / 100;
    return currency + floatingAmount.toFixed(2);
  }

}
