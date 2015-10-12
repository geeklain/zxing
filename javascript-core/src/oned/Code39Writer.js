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
import {ALPHABET, CHARACTER_ENCODINGS} from './Code39Reader';

import BarcodeFormat from '../BarcodeFormat';

import IllegalArgumentException from '../IllegalArgumentException';

/**
 * This object renders a CODE39 code as a {@link BitMatrix}.
 * 
 * @author erik.barbara@gmail.com (Erik Barbara)
 */
export default class Code39Writer extends OneDimensionalCodeWriter {

  encode(contents, format, width, height, hints) {
    if (format !== BarcodeFormat.CODE_39) {
      throw new IllegalArgumentException('Can only encode CODE_39, but got ' + format);
    }
    return super.encode(contents, format, width, height, hints);
  }

  doEncode(contents) {
    const length = contents.length;
    if (length > 80) {
      throw new IllegalArgumentException(
          'Requested contents should be less than 80 digits long, but got ' + length);
    }

    const widths = new Array(9);
    let codeWidth = 24 + 1 + length;
    for (let i = 0; i < length; i++) {
      const indexInString = ALPHABET.indexOf(contents.charAt(i));
      if (indexInString < 0) {
        throw new IllegalArgumentException('Bad contents: ' + contents);
      }
      Code39Writer.toIntArray(CHARACTER_ENCODINGS[indexInString], widths);
      widths.forEach((width) => {
        codeWidth += width;
      });
    }
    const result = new Array(codeWidth);
    Code39Writer.toIntArray(CHARACTER_ENCODINGS[39], widths);
    let pos = Code39Writer.appendPattern(result, 0, widths, true);
    const narrowWhite = [1];
    pos += Code39Writer.appendPattern(result, pos, narrowWhite, false);
    //append next character to byte matrix
    for (let i = 0; i < length; i++) {
      const indexInString = ALPHABET.indexOf(contents.charAt(i));
      Code39Writer.toIntArray(CHARACTER_ENCODINGS[indexInString], widths);
      pos += Code39Writer.appendPattern(result, pos, widths, true);
      pos += Code39Writer.appendPattern(result, pos, narrowWhite, false);
    }
    Code39Writer.toIntArray(CHARACTER_ENCODINGS[39], widths);
    Code39Writer.appendPattern(result, pos, widths, true);
    return result;
  }

  static toIntArray(a, toReturn) {
    for (let i = 0; i < 9; i++) {
      const temp = a & (1 << (8 - i));
      toReturn[i] = temp === 0 ? 1 : 2;
    }
  }
}