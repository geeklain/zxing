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

import {FIRST_DIGIT_ENCODINGS} from './EAN13Reader';

import UPCEANReader, {START_END_PATTERN, L_AND_G_PATTERNS, L_PATTERNS, MIDDLE_PATTERN} from './UPCEANReader';
import UPCEANWriter from './UPCEANWriter';

import BarcodeFormat from '../BarcodeFormat';
import IllegalArgumentException from '../IllegalArgumentException';

const CODE_WIDTH = 3 // start guard
  + (7 * 6) // left bars
  + 5 // middle guard
  + (7 * 6) // right bars
  + 3; // end guard

/**
 * This object renders an EAN13 code as a {@link BitMatrix}.
 *
 * @author aripollak@gmail.com (Ari Pollak)
 */
export default class EAN13Writer extends UPCEANWriter {

  encode(contents, format, width, height, hints) {
    if (format !== BarcodeFormat.EAN_13) {
      throw new IllegalArgumentException('Can only encode EAN_13, but got ' + format);
    }

    return super.encode(contents, format, width, height, hints);
  }

  doEncode(contents) {
    if (contents.length !== 13) {
      throw new IllegalArgumentException('Requested contents should be 13 digits long, but got ' + contents.length);
    }
    
    try {
      if (!UPCEANReader.checkStandardUPCEANChecksum(contents)) {
        throw new IllegalArgumentException('Contents do not pass checksum');
      }
    } catch (ignored) {
      throw new IllegalArgumentException('Illegal contents');
    }

    const firstDigit = Number.parseInt(contents.substring(0, 1));
    const parities = FIRST_DIGIT_ENCODINGS[firstDigit];
    const result = new Array(CODE_WIDTH);
    let pos = 0;
    
    pos += EAN13Writer.appendPattern(result, pos, START_END_PATTERN, true);

    // See {@link #EAN13Reader} for a description of how the first digit & left bars are encoded
    for (let i = 1; i <= 6; i++) {
      let digit = Number.parseInt(contents.substring(i, i + 1));
      if ((parities >> (6 - i) & 1) === 1) {
        digit += 10;
      }
      pos += EAN13Writer.appendPattern(result, pos, L_AND_G_PATTERNS[digit], false);
    }

    pos += EAN13Writer.appendPattern(result, pos, MIDDLE_PATTERN, false);

    for (let i = 7; i <= 12; i++) {
      let digit = Number.parseInt(contents.substring(i, i + 1));
      pos += EAN13Writer.appendPattern(result, pos, L_PATTERNS[digit], true);
    }
    EAN13Writer.appendPattern(result, pos, START_END_PATTERN, true);

    return result;
  }

}
