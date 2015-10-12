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
import DecodeHintType from '../DecodeHintType';
import NotFoundException from '../NotFoundException';
import Result from '../Result';
import ResultPoint from '../ResultPoint';


// These values are critical for determining how permissive the decoding
// will be. All stripe sizes must be within the window these define, as
// compared to the average stripe size.
const MAX_ACCEPTABLE = 2.0;
const PADDING = 1.5;
export const ALPHABET = Object.freeze('0123456789-$:/.+ABCD'.split(''));

/**
 * These represent the encodings of characters, as patterns of wide and narrow bars. The 7 least-significant bits of
 * each int correspond to the pattern of wide and narrow, with 1s representing "wide" and 0s representing narrow.
 */
export const CHARACTER_ENCODINGS = Object.freeze([
  0x003, 0x006, 0x009, 0x060, 0x012, 0x042, 0x021, 0x024, 0x030, 0x048, // 0-9
  0x00c, 0x018, 0x045, 0x051, 0x054, 0x015, 0x01A, 0x029, 0x00B, 0x00E  // -$:/.+ABCD
]);

// minimal number of characters that should be present (inclusing start and stop characters)
// under normal circumstances this should be set to 3, but can be set higher
// as a last-ditch attempt to reduce false positives.
const MIN_CHARACTER_LENGTH = 3;

// official start and end patterns
const STARTEND_ENCODING = Object.freeze(['A', 'B', 'C', 'D']);
// some codabar generator allow the codabar string to be closed by every
// character. This will cause lots of false positives!

// some industries use a checksum standard but this is not part of the original codabar standard
// for more information see : http://www.mecsw.com/specs/codabar.html

/**
 * <p>Decodes Codabar barcodes.</p>
 *
 * @author Bas Vijfwinkel
 * @author David Walker
 */
export default class CodaBarReader extends OneDReader {

  constructor() {
    super();
    this.decodeRowResult = [];
    this.counters = [];
    this.counterLength = 0;
  }

  decodeRow(rowNumber, row, hints) {

    this.counters.fill(0);
    this.setCounters(row);
    const startOffset = this.findStartPattern();
    let nextStart = startOffset;

    this.decodeRowResult = [];
    do {
      const charOffset = this.toNarrowWidePattern(nextStart);
      if (charOffset === -1) {
        throw NotFoundException.getNotFoundInstance();
      }
      // Hack: We store the position in the alphabet table into a
      // StringBuilder, so that we can access the decoded patterns in
      // validatePattern. We'll translate to the actual characters later.
      this.decodeRowResult.push(charOffset);
      nextStart += 8;
      // Stop as soon as we see the end character.
      if (this.decodeRowResult.length > 1 && CodaBarReader.arrayContains(STARTEND_ENCODING, ALPHABET[charOffset])) {
        break;
      }
    } while (nextStart < this.counterLength); // no fixed end pattern so keep on reading while data is available

    // Look for whitespace after pattern:
    const trailingWhitespace = this.counters[nextStart - 1];
    let lastPatternSize = 0;
    for (let i = -8; i < -1; i++) {
      lastPatternSize += this.counters[nextStart + i];
    }

    // We need to see whitespace equal to 50% of the last pattern size,
    // otherwise this is probably a false positive. The exception is if we are
    // at the end of the row. (I.e. the barcode barely fits.)
    if (nextStart < this.counterLength && trailingWhitespace < Math.floor(lastPatternSize / 2)) {
      throw NotFoundException.getNotFoundInstance();
    }

    this.validatePattern(startOffset);

    // Translate character table offsets to actual characters.
    for (let i = 0; i < this.decodeRowResult.length; i++) {
      this.decodeRowResult[i] = ALPHABET[this.decodeRowResult[i]];
    }
    // Ensure a valid start and end character
    const startchar = this.decodeRowResult[0];
    if (!CodaBarReader.arrayContains(STARTEND_ENCODING, startchar)) {
      throw NotFoundException.getNotFoundInstance();
    }
    const endchar = this.decodeRowResult[this.decodeRowResult.length - 1];
    if (!CodaBarReader.arrayContains(STARTEND_ENCODING, endchar)) {
      throw NotFoundException.getNotFoundInstance();
    }

    // remove stop/start characters character and check if a long enough string is contained
    if (this.decodeRowResult.length <= MIN_CHARACTER_LENGTH) {
      // Almost surely a false positive ( start + stop + at least 1 character)
      throw NotFoundException.getNotFoundInstance();
    }

    if (!hints || !hints[DecodeHintType.RETURN_CODABAR_START_END]) {
      this.decodeRowResult.splice(this.decodeRowResult.length - 1, 1);
      this.decodeRowResult.splice(0, 1);
    }

    let runningCount = 0;
    for (let i = 0; i < startOffset; i++) {
      runningCount += this.counters[i];
    }
    const left = runningCount;
    for (let i = startOffset; i < nextStart - 1; i++) {
      runningCount += this.counters[i];
    }
    const right = runningCount;
    return new Result(
      this.decodeRowResult.join(''),
      null, [
        new ResultPoint(left, rowNumber),
        new ResultPoint(right, rowNumber)
      ],
      BarcodeFormat.CODABAR);
  }

  validatePattern(start) {
    // First, sum up the total size of our four categories of stripe sizes;
    const sizes = [0, 0, 0, 0];
    const counts = [0, 0, 0, 0];
    const end = this.decodeRowResult.length - 1;

    // We break out of this loop in the middle, in order to handle
    // inter-character spaces properly.
    let pos = start;
    for (let i = 0; i <= end; i++) {
      let pattern = CHARACTER_ENCODINGS[this.decodeRowResult[i]];
      for (let j = 6; j >= 0; j--) {
        // Even j = bars, while odd j = spaces. Categories 2 and 3 are for
        // long stripes, while 0 and 1 are for short stripes.
        const category = (j & 1) + (pattern & 1) * 2;
        sizes[category] += this.counters[pos + j];
        counts[category]++;
        pattern >>= 1;
      }
      if (i >= end) {
        break;
      }
      // We ignore the inter-character space - it could be of any size.
      pos += 8;
    }

    // Calculate our allowable size thresholds using fixed-point math.
    const maxes = new Float64Array(4);
    const mins = new Float64Array(4);
    // Define the threshold of acceptability to be the midpoint between the
    // average small stripe and the average large stripe. No stripe lengths
    // should be on the "wrong" side of that line.
    for (let i = 0; i < 2; i++) {
      mins[i] = 0.0; // Accept arbitrarily small "short" stripes.
      mins[i + 2] = (sizes[i] / counts[i] + sizes[i + 2] / counts[i + 2]) / 2.0;
      maxes[i] = mins[i + 2];
      maxes[i + 2] = (sizes[i + 2] * MAX_ACCEPTABLE + PADDING) / counts[i + 2];
    }

    // Now verify that all of the stripes are within the thresholds.
    pos = start;
    for (let i = 0; i <= end; i++) {
      let pattern = CHARACTER_ENCODINGS[this.decodeRowResult[i]];
      for (let j = 6; j >= 0; j--) {
        // Even j = bars, while odd j = spaces. Categories 2 and 3 are for
        // long stripes, while 0 and 1 are for short stripes.
        const category = (j & 1) + (pattern & 1) * 2;
        const size = this.counters[pos + j];
        if (size < mins[category] || size > maxes[category]) {
          throw NotFoundException.getNotFoundInstance();
        }
        pattern >>= 1;
      }
      if (i >= end) {
        break;
      }
      pos += 8;
    }
  }

  /**
   * Records the size of all runs of white and black pixels, starting with white.
   * This is just like recordPattern, except it records all the counters, and
   * uses our builtin "counters" member for storage.
   * @param row row to count from
   */
  setCounters(row) {
    this.counterLength = 0;
    // Start from the first white bit.
    let i = row.getNextUnset(0);
    const end = row.getSize();
    if (i >= end) {
      throw NotFoundException.getNotFoundInstance();
    }
    let isWhite = true;
    let count = 0;
    while (i < end) {
      if (row.get(i) ^ isWhite) { // that is, exactly one is true
        count++;
      }
      else {
        this.counterAppend(count);
        count = 1;
        isWhite = !isWhite;
      }
      i++;
    }
    this.counterAppend(count);
  }

  counterAppend(e) {
    this.counters[this.counterLength] = e;
    this.counterLength++;
  }

  findStartPattern() {
    for (let i = 1; i < this.counterLength; i += 2) {
      const charOffset = this.toNarrowWidePattern(i);
      if (charOffset !== -1 && CodaBarReader.arrayContains(STARTEND_ENCODING, ALPHABET[charOffset])) {
        // Look for whitespace before start pattern, >= 50% of width of start pattern
        // We make an exception if the whitespace is the first element.
        let patternSize = 0;
        for (let j = i; j < i + 7; j++) {
          patternSize += this.counters[j];
        }
        if (i === 1 || this.counters[i - 1] >= Math.floor(patternSize / 2)) {
          return i;
        }
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  static arrayContains(array, key) {
    if (!array) {
      return false;
    }
    return array.some((character) => character === key);
  }

  // Assumes that counters[position] is a bar.
  toNarrowWidePattern(position) {
    const end = position + 7;
    if (end >= this.counterLength) {
      return -1;
    }

    let maxBar = 0;
    let minBar = Number.MAX_VALUE;
    for (let j = position; j < end; j += 2) {
      const currentCounter = this.counters[j];
      if (currentCounter < minBar) {
        minBar = currentCounter;
      }
      if (currentCounter > maxBar) {
        maxBar = currentCounter;
      }
    }
    const thresholdBar = Math.floor((minBar + maxBar) / 2);

    let maxSpace = 0;
    let minSpace = Number.MAX_VALUE;
    for (let j = position + 1; j < end; j += 2) {
      const currentCounter = this.counters[j];
      if (currentCounter < minSpace) {
        minSpace = currentCounter;
      }
      if (currentCounter > maxSpace) {
        maxSpace = currentCounter;
      }
    }
    const thresholdSpace = Math.floor((minSpace + maxSpace) / 2);

    let bitmask = 1 << 7;
    let pattern = 0;
    for (let i = 0; i < 7; i++) {
      const threshold = (i & 1) == 0 ? thresholdBar : thresholdSpace;
      bitmask >>= 1;
      if (this.counters[position + i] > threshold) {
        pattern |= bitmask;
      }
    }

    for (let i = 0; i < CHARACTER_ENCODINGS.length; i++) {
      if (CHARACTER_ENCODINGS[i] === pattern) {
        return i;
      }
    }
    return -1;
  }
}
