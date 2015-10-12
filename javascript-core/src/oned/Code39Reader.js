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

import OneDReader from './OneDReader';

import BarcodeFormat from '../BarcodeFormat';
import Result from '../Result';
import ResultPoint from '../ResultPoint';

import ChecksumException from '../ChecksumException';
import FormatException from '../FormatException';
import NotFoundException from '../NotFoundException';

export const ALPHABET = Object.freeze('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. *$/+%'.split(''));

/**
 * These represent the encodings of characters, as patterns of wide and narrow bars.
 * The 9 least-significant bits of each int correspond to the pattern of wide and narrow,
 * with 1s representing "wide" and 0s representing narrow.
 */
export const CHARACTER_ENCODINGS = Object.freeze([
  0x034, 0x121, 0x061, 0x160, 0x031, 0x130, 0x070, 0x025, 0x124, 0x064, // 0-9
  0x109, 0x049, 0x148, 0x019, 0x118, 0x058, 0x00D, 0x10C, 0x04C, 0x01C, // A-J
  0x103, 0x043, 0x142, 0x013, 0x112, 0x052, 0x007, 0x106, 0x046, 0x016, // K-T
  0x181, 0x0C1, 0x1C0, 0x091, 0x190, 0x0D0, 0x085, 0x184, 0x0C4, 0x094, // U-*
  0x0A8, 0x0A2, 0x08A, 0x02A // $-%
]);

const ASTERISK_ENCODING = CHARACTER_ENCODINGS[39];

/**
 * <p>Decodes Code 39 barcodes. This does not support "Full ASCII Code 39" yet.</p>
 *
 * @author Sean Owen
 * @see Code93Reader
 */
export default class Code39Reader extends OneDReader {

  /**
   * Creates a reader that can be configured to check the last character as a check digit,
   * or optionally attempt to decode "extended Code 39" sequences that are used to encode
   * the full ASCII character set.
   *
   * @param usingCheckDigit if true, treat the last data character as a check digit, not
   * data, and verify that the checksum passes.
   * @param extendedMode if true, will attempt to decode extended Code 39 sequences in the
   * text.
   */
  constructor(usingCheckDigit = false, extendedMode = false) {
    super();
    this.usingCheckDigit = usingCheckDigit;
    this.extendedMode = extendedMode;
    this.decodeRowResult = [];
    this.counters = new Int32Array(9);
  }

  decodeRow(rowNumber, row) {

    this.counters.fill(0);
    this.decodeRowResult = [];

    const start = Code39Reader.findAsteriskPattern(row, this.counters);
    // Read off white space    
    let nextStart = row.getNextSet(start[1]);
    const end = row.getSize();

    let decodedChar;
    let lastStart;
    do {
      Code39Reader.recordPattern(row, nextStart, this.counters);
      const pattern = Code39Reader.toNarrowWidePattern(this.counters);
      if (pattern < 0) {
        throw NotFoundException.getNotFoundInstance();
      }
      decodedChar = Code39Reader.patternToChar(pattern);
      this.decodeRowResult.push(decodedChar);
      lastStart = nextStart;
      this.counters.forEach((counter) => {
        nextStart += counter;
      });
      // Read off white space
      nextStart = row.getNextSet(nextStart);
    } while (decodedChar !== '*');
    this.decodeRowResult.splice(this.decodeRowResult.length - 1, 1); // remove asterisk

    // Look for whitespace after pattern:
    let lastPatternSize = 0;
    this.counters.forEach((counter) => {
      lastPatternSize += counter;
    });
    const whiteSpaceAfterEnd = nextStart - lastStart - lastPatternSize;
    // If 50% of last pattern size, following last pattern, is not whitespace, fail
    // (but if it's whitespace to the very end of the image, that's OK)
    if (nextStart !== end && (whiteSpaceAfterEnd * 2) < lastPatternSize) {
      throw NotFoundException.getNotFoundInstance();
    }

    if (this.usingCheckDigit) {
      const max = this.decodeRowResult.length - 1;
      let total = 0;
      for (let i = 0; i < max; i++) {
        total += ALPHABET.indexOf(this.decodeRowResult.charAt(i));
      }
      if (this.decodeRowResult.charAt(max) !== ALPHABET[total % 43]) {
        throw ChecksumException.getChecksumInstance();
      }
      this.decodeRowResult.splice(max, this.decodeRowResult.length - max);
    }

    if (this.decodeRowResult.length === 0) {
      // false positive
      throw NotFoundException.getNotFoundInstance();
    }

    let resultString;
    if (this.extendedMode) {
      resultString = Code39Reader.decodeExtended(this.decodeRowResult);
    }
    else {
      resultString = this.decodeRowResult.join('');
    }

    const left = (start[1] + start[0]) / 2.0;
    const right = lastStart + lastPatternSize / 2.0;
    return new Result(
      resultString,
      null, [
        new ResultPoint(left, rowNumber),
        new ResultPoint(right, rowNumber)
      ],
      BarcodeFormat.CODE_39);
  }

  static findAsteriskPattern(row, counters) {
    const width = row.getSize();
    const rowOffset = row.getNextSet(0);

    let counterPosition = 0;
    let patternStart = rowOffset;
    let isWhite = false;
    let patternLength = counters.length;

    for (let i = rowOffset; i < width; i++) {
      if (row.get(i) ^ isWhite) {
        counters[counterPosition]++;
      }
      else {
        if (counterPosition === patternLength - 1) {
          // Look for whitespace before start pattern, >= 50% of width of start pattern
          if (Code39Reader.toNarrowWidePattern(counters) === ASTERISK_ENCODING
            && row.isRange(Math.max(0, patternStart - Math.floor((i - patternStart) / 2)), patternStart, false)) {
            return [patternStart, i];
          }
          patternStart += counters[0] + counters[1];
          for (let j = 0; j < patternLength - 2; j++) {
            counters[j] = counters[j + 2];
          }
          counters[patternLength - 2] = 0;
          counters[patternLength - 1] = 0;
          counterPosition--;
        }
        else {
          counterPosition++;
        }
        counters[counterPosition] = 1;
        isWhite = !isWhite;
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  // For efficiency, returns -1 on failure. Not throwing here saved as many as 700 exceptions
  // per image when using some of our blackbox images.
  static toNarrowWidePattern(counters) {
    const numCounters = counters.length;

    let maxNarrowCounter = 0;
    let wideCounters;
    do {
      let minCounter = Number.MAX_VALUE;
      counters.forEach((counter) => {
        if (maxNarrowCounter < counter && counter < minCounter) {
          minCounter = counter;
        }
      });
      maxNarrowCounter = minCounter;
      wideCounters = 0;
      let totalWideCountersWidth = 0;
      let pattern = 0;
      for (let i = 0; i < numCounters; i++) {
        const counter = counters[i];
        if (counter > maxNarrowCounter) {
          pattern |= 1 << (numCounters - 1 - i);
          wideCounters++;
          totalWideCountersWidth += counter;
        }
      }
      if (wideCounters === 3) {
        // Found 3 wide counters, but are they close enough in width?
        // We can perform a cheap, conservative check to see if any individual
        // counter is more than 1.5 times the average:
        for (let i = 0; i < numCounters && wideCounters > 0; i++) {
          const counter = counters[i];
          if (counter > maxNarrowCounter) {
            wideCounters--;
            // totalWideCountersWidth = 3 * average, so this checks if counter >= 3/2 * average
            if ((counter * 2) >= totalWideCountersWidth) {
              return -1;
            }
          }
        }
        return pattern;
      }
    } while (wideCounters > 3);
    return -1;
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
      const c = encoded.charAt(i);
      if (c === '+' || c === '$' || c === '%' || c === '/') {
        const next = encoded.charAt(i + 1);
        const nextCode = encoded.charCodeAt(i + 1);
        let decodedChar = '\0';
        switch (c) {
          case '+':
            // +A to +Z map to a to z
            if (next >= 'A' && next <= 'Z') {
              decodedChar = String.fromCharCode(nextCode + 32);
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
          case '$':
            // $A to $Z map to control codes SH to SB
            if (next >= 'A' && next <= 'Z') {
              decodedChar = String.fromCharCode(nextCode - 64);
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
          case '%':
            // %A to %E map to control codes ESC to US
            if (next >= 'A' && next <= 'E') {
              decodedChar = String.fromCharCode(nextCode - 38);
            }
            else if (next >= 'F' && next <= 'W') {
              decodedChar = String.fromCharCode(nextCode - 11);
            }
            else {
              throw FormatException.getFormatInstance();
            }
            break;
          case '/':
            // /A to /O map to ! to , and /Z maps to :
            if (next >= 'A' && next <= 'O') {
              decodedChar = String.fromCharCode(nextCode - 32);
            }
            else if (next === 'Z') {
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
}