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

import OneDimensionalCodeWriter from './OneDimensionalCodeWriter';
import {PATTERNS} from './ITFReader';

import BarcodeFormat from '../BarcodeFormat';

import IllegalArgumentException from '../IllegalArgumentException';

const START_PATTERN = Object.freeze([1, 1, 1, 1]);
const END_PATTERN = Object.freeze([3, 1, 1]);

/**
 * This object renders a ITF code as a {@link BitMatrix}.
 * 
 * @author erik.barbara@gmail.com (Erik Barbara)
 */
export default class ITFWriter extends OneDimensionalCodeWriter {

  encode(contents, format, width, height, hints) {
    if (format !== BarcodeFormat.ITF) {
      throw new IllegalArgumentException('Can only encode ITF, but got ' + format);
    }

    return super.encode(contents, format, width, height, hints);
  }

  doEncode(contents) {
    const length = contents.length;
    if (length % 2 !== 0) {
      throw new IllegalArgumentException('The lenght of the input should be even');
    }
    if (length > 80) {
      throw new IllegalArgumentException(
          'Requested contents should be less than 80 digits long, but got ' + length);
    }
    const result = [];
    let pos = ITFWriter.appendPattern(result, 0, START_PATTERN, true);
    for (let i = 0; i < length; i += 2) {
      const one = Number.parseInt(contents.charAt(i));
      const two = Number.parseInt(contents.charAt(i + 1));
      const encoding = new Int32Array(18);
      for (let j = 0; j < 5; j++) {
        encoding[2 * j] = PATTERNS[one][j];
        encoding[2 * j + 1] = PATTERNS[two][j];
      }
      pos += ITFWriter.appendPattern(result, pos, encoding, true);
    }
    ITFWriter.appendPattern(result, pos, END_PATTERN, true);

    return result;
  }

}