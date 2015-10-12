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

import OneDReader from './OneDReader';

import BarcodeFormat from '../BarcodeFormat';
import Result from '../Result';
import ResultPoint from '../ResultPoint';

import ChecksumException from '../ChecksumException';
import FormatException from '../FormatException';
import NotFoundException from '../NotFoundException';

// Note that 'abcd' are dummy characters in place of control characters.
const ALPHABET = Object.freeze('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%abcd*'.split(''));

/**
 * These represent the encodings of characters, as patterns of wide and narrow bars.
 * The 9 least-significant bits of each int correspond to the pattern of wide and narrow.
 */
const CHARACTER_ENCODINGS = Object.freeze([
  0x114, 0x148, 0x144, 0x142, 0x128, 0x124, 0x122, 0x150, 0x112, 0x10A, // 0-9
  0x1A8, 0x1A4, 0x1A2, 0x194, 0x192, 0x18A, 0x168, 0x164, 0x162, 0x134, // A-J
  0x11A, 0x158, 0x14C, 0x146, 0x12C, 0x116, 0x1B4, 0x1B2, 0x1AC, 0x1A6, // K-T
  0x196, 0x19A, 0x16C, 0x166, 0x136, 0x13A, // U-Z
  0x12E, 0x1D4, 0x1D2, 0x1CA, 0x16E, 0x176, 0x1AE, // - - %
  0x126, 0x1DA, 0x1D6, 0x132, 0x15E // Control chars? $-*
]);
const ASTERISK_ENCODING = CHARACTER_ENCODINGS[47];

/**
 * <p>Decodes Code 93 barcodes.</p>
 *
 * @author Sean Owen
 * @see Code39Reader
 */
export default class Code93Reader extends OneDReader {

  constructor() {
    super();
    this.decodeRowResult = [];
    this.counters = new Int32Array(6);
  }

  decodeRow(rowNumber, row) {

    const start = this.findAsteriskPattern(row);
    // Read off white space    
    let nextStart = row.getNextSet(start[1]);
    const end = row.getSize();

    this.counters.fill(0);
    this.decodeRowResult = [];

    let decodedChar;
    let lastStart;
    do {
      Code93Reader.recordPattern(row, nextStart, this.counters);
      const pattern = Code93Reader.toPattern(this.counters);
      if (pattern < 0) {
        throw NotFoundException.getNotFoundInstance();
      }
      decodedChar = Code93Reader.patternToChar(pattern);
      this.decodeRowResult.push(decodedChar);
      lastStart = nextStart;
      this.counters.forEach((counter) => {
        nextStart += counter;
      });
      // Read off white space
      nextStart = row.getNextSet(nextStart);
    } while (decodedChar !== '*');

    this.decodeRowResult.splice(this.decodeRowResult.length - 1, 1); // remove asterisk

    let lastPatternSize = 0;
    this.counters.forEach((counter) => {
      lastPatternSize += counter;
    });

    // Should be at least one more black module
    if (nextStart === end || !row.get(nextStart)) {
      throw NotFoundException.getNotFoundInstance();
    }

    if (this.decodeRowResult.length < 2) {
      // false positive -- need at least 2 checksum digits
      throw NotFoundException.getNotFoundInstance();
    }

    Code93Reader.checkChecksums(this.decodeRowResult);
    // Remove checksum digits
    this.decodeRowResult.splice(this.decodeRowResult.length - 2, 2);

    const resultString = Code93Reader.decodeExtended(this.decodeRowResult);

    const left = (start[1] + start[0]) / 2.0;
    const right = lastStart + lastPatternSize / 2.0;
    return new Result(
      resultString,
      null, [
        new ResultPoint(left, rowNumber),
        new ResultPoint(right, rowNumber)
      ],
      BarcodeFormat.CODE_93);

  }

  findAsteriskPattern(row) {
    const width = row.getSize();
    const rowOffset = row.getNextSet(0);

    this.counters.fill(0);
    let patternStart = rowOffset;
    let isWhite = false;
    const patternLength = this.counters.length;

    let counterPosition = 0;
    for (let i = rowOffset; i < width; i++) {
      if (row.get(i) ^ isWhite) {
        this.counters[counterPosition]++;
      }
      else {
        if (counterPosition === patternLength - 1) {
          if (Code93Reader.toPattern(this.counters) === ASTERISK_ENCODING) {
            return [patternStart, i];
          }
          patternStart += this.counters[0] + this.counters[1];
          for (let j = 0; j < patternLength - 2; j++) {
            this.counters[j] = this.counters[2 + j];
          }
          this.counters[patternLength - 2] = 0;
          this.counters[patternLength - 1] = 0;
          counterPosition--;
        }
        else {
          counterPosition++;
        }
        this.counters[counterPosition] = 1;
        isWhite = !isWhite;
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  static toPattern(counters) {
    const max = counters.length;
    let sum = 0;
    counters.forEach((counter) => {
      sum += counter;
    });
    let pattern = 0;
    for (let i = 0; i < max; i++) {
      const scaled = Math.round(counters[i] * 9.0 / sum);
      if (scaled < 1 || scaled > 4) {
        return -1;
      }
      if ((i & 0x01) === 0) {
        for (let j = 0; j < scaled; j++) {
          pattern = (pattern << 1) | 0x01;
        }
      }
      else {
        pattern <<= scaled;
      }
    }
    return pattern;
  }

  static patternToChar(pattern) {
    for (let i = 0; i < CHARACTER_ENCODINGS.length; i++) {
      if (CHARACTER_ENCODINGS[i] === pattern) {
        return ALPHABET[i];
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  static decodeExtended(encoded) {
    const length = encoded.length;
    const decoded = [];
    for (let i = 0; i < length; i++) {
      const c = encoded[i];
      if (c >= 'a' && c <= 'd') {
        if (i >= length - 1) {
          throw FormatException.getFormatInstance();
        }
        const next = encoded[i + 1];
        const nextCode = next.charCodeAt(0);
        let decodedChar = '\0';
        switch (c) {
          case 'd':
            // +A to +Z map to a to z
            if (next >= 'A' && next <= 'Z') {
              decodedChar = String.fromCharCode(nextCode + 32);
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
          case 'a':
            // $A to $Z map to control codes SH to SB
            if (next >= 'A' && next <= 'Z') {
              decodedChar = String.fromCharCode(nextCode - 64);
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
          case 'b':
            if (next >= 'A' && next <= 'E') {
              // %A to %E map to control codes ESC to USep
              decodedChar = String.fromCharCode(nextCode - 38);
            }
            else if (next >= 'F' && next <= 'J') {
              // %F to %J map to ; < = > ?
              decodedChar = String.fromCharCode(nextCode - 11);
            }
            else if (next >= 'K' && next <= 'O') {
              // %K to %O map to [ \ ] ^ _
              decodedChar = String.fromCharCode(nextCode + 16);
            }
            else if (next >= 'P' && next <= 'S') {
              // %P to %S map to { | } ~
              decodedChar = String.fromCharCode(nextCode + 43);
            }
            else if (next >= 'T' && next <= 'Z') {
              // %T to %Z all map to DEL (127)
              decodedChar = 127;
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
          case 'c':
            // /A to /O map to ! to , and /Z maps to :
            if (next >= 'A' && next <= 'O') {
              decodedChar = String.fromCharCode(nextCode - 32);
            }
            else if (next == 'Z') {
              decodedChar = ':';
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
        }
        decoded.push(decodedChar);
        // bump up i again since we read two characters
        i++;
      }
      else {
        decoded.push(c);
      }
    }
    return decoded.join('');
  }

  static checkChecksums(result) {
    const length = result.length;
    Code93Reader.checkOneChecksum(result, length - 2, 20);
    Code93Reader.checkOneChecksum(result, length - 1, 15);
  }

  static checkOneChecksum(result, checkPosition, weightMax) {
    let weight = 1;
    let total = 0;
    for (let i = checkPosition - 1; i >= 0; i--) {
      total += weight * ALPHABET.indexOf(result[i]);
      if (++weight > weightMax) {
        weight = 1;
      }
    }
    if (result[checkPosition] !== ALPHABET[total % 47]) {
      throw ChecksumException.getChecksumInstance();
    }
  }

}
