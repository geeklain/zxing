/*
 * Copyright (C) 2012 ZXing authors
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

import UPCEANReader from './UPCEANReader';

import BarcodeFormat from '../BarcodeFormat'; 
import Result from '../Result';
import ResultMetadataType from '../ResultMetadataType';
import ResultPoint from '../ResultPoint';

import NotFoundException from '../NotFoundException';

/**
 * @see UPCEANExtension5Support
 */
export default class UPCEANExtension2Support {

  constructor() {
    this.decodeMiddleCounters = new Int32Array(4);
  }

  decodeRow(rowNumber, row, extensionStartRange) {

    const result = [];
    const end = this.decodeMiddle(row, extensionStartRange, result);

    const resultString = result.join('');
    const extensionData = UPCEANExtension2Support.parseExtensionString(resultString);

    const extensionResult =
      new Result(resultString,
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

    let checkParity = 0;

    for (let x = 0; x < 2 && rowOffset < end; x++) {
      const bestMatch = UPCEANReader.decodeDigit(row, counters, rowOffset, UPCEANReader.L_AND_G_PATTERNS);
      resultString.push(bestMatch % 10);
      counters.forEach(function (counter) {
        rowOffset += counter;
      });
      if (bestMatch >= 10) {
        checkParity |= 1 << (1 - x);
      }
      if (x !== 1) {
        // Read off separator if not last
        rowOffset = row.getNextSet(rowOffset);
        rowOffset = row.getNextUnset(rowOffset);
      }
    }

    if (resultString.length !== 2) {
      throw NotFoundException.getNotFoundInstance();
    }

    if (parseInt(resultString.join('')) % 4 !== checkParity) {
      throw NotFoundException.getNotFoundInstance();
    }

    return rowOffset;
  }

  /**
   * @param raw raw content of extension
   * @return formatted interpretation of raw content as a {@link Map} mapping
   *  one {@link ResultMetadataType} to appropriate value, or {@code null} if not known
   */
  static parseExtensionString(raw) {
    if (raw.length !== 2) {
      return null;
    }
    const result = {};
    result[ResultMetadataType.ISSUE_NUMBER] = parseInt(raw);
    return result;
  }

}
