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

import UPCEANWriter from './UPCEANWriter';
import {START_END_PATTERN, L_PATTERNS, MIDDLE_PATTERN} from './UPCEANReader';

import BarcodeFormat from '../BarcodeFormat';

import IllegalArgumentException from '../IllegalArgumentException';

const CODE_WIDTH = 3 + // start guard
    (7 * 4) + // left bars
    5 + // middle guard
    (7 * 4) + // right bars
    3; // end guard

/**
 * This object renders an EAN8 code as a {@link BitMatrix}.
 *
 * @author aripollak@gmail.com (Ari Pollak)
 */
export default class EAN8Writer extends UPCEANWriter {

  encode(contents, format, width, height, hints) {
    if (format !== BarcodeFormat.EAN_8) {
      throw new IllegalArgumentException('Can only encode EAN_8, but got ' + format);
    }

    return super.encode(contents, format, width, height, hints);
  }

  /**
   * @return a byte array of horizontal pixels (false = white, true = black)
   */
  doEncode(contents) {
    if (contents.length !== 8) {
      throw new IllegalArgumentException(
          'Requested contents should be 8 digits long, but got' + contents.length);
    }

    const result = new Array(CODE_WIDTH);
    let pos = 0;

    pos += EAN8Writer.appendPattern(result, pos, START_END_PATTERN, true);

    for (let i = 0; i <= 3; i++) {
      const digit = Number.parseInt(contents.substring(i, i + 1));
      pos += EAN8Writer.appendPattern(result, pos, L_PATTERNS[digit], false);
    }

    pos += EAN8Writer.appendPattern(result, pos, MIDDLE_PATTERN, false);

    for (let i = 4; i <= 7; i++) {
      const digit = Number.parseInt(contents.substring(i, i + 1));
      pos += EAN8Writer.appendPattern(result, pos, L_PATTERNS[digit], true);
    }
    EAN8Writer.appendPattern(result, pos, START_END_PATTERN, true);

    return result;
  }

}
