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
import Result from '../Result';
import ResultPoint from '../ResultPoint';

import FormatException from '../FormatException';
import NotFoundException from '../NotFoundException';

const MAX_AVG_VARIANCE = 0.38;
const MAX_INDIVIDUAL_VARIANCE = 0.78;

const W = 3; // Pixel width of a wide line
const N = 1; // Pixed width of a narrow line

/** Valid ITF lengths. Anything longer than the largest value is also allowed. */
const DEFAULT_ALLOWED_LENGTHS = Object.freeze([6, 8, 10, 12, 14]);

/**
 * Start/end guard pattern.
 *
 * Note: The end pattern is reversed because the row is reversed before
 * searching for the END_PATTERN
 */
const START_PATTERN = Object.freeze([N, N, N, N]);
const END_PATTERN_REVERSED = Object.freeze([N, N, W]);

/**
 * Patterns of Wide / Narrow lines to indicate each digit
 */
export const PATTERNS = Object.freeze([
  Object.freeze([N, N, W, W, N]), // 0
  Object.freeze([W, N, N, N, W]), // 1
  Object.freeze([N, W, N, N, W]), // 2
  Object.freeze([W, W, N, N, N]), // 3
  Object.freeze([N, N, W, N, W]), // 4
  Object.freeze([W, N, W, N, N]), // 5
  Object.freeze([N, W, W, N, N]), // 6
  Object.freeze([N, N, N, W, W]), // 7
  Object.freeze([W, N, N, W, N]), // 8
  Object.freeze([N, W, N, W, N]) // 9
]);

/**
 * <p>Implements decoding of the ITF format, or Interleaved Two of Five.</p>
 *
 * <p>This Reader will scan ITF barcodes of certain lengths only.
 * At the moment it reads length 6, 8, 10, 12, 14, 16, 18, 20, 24, and 44 as these have appeared "in the wild". Not all
 * lengths are scanned, especially shorter ones, to avoid false positives. This in turn is due to a lack of
 * required checksum function.</p>
 *
 * <p>The checksum is optional and is not applied by this Reader. The consumer of the decoded
 * value will have to apply a checksum if required.</p>
 *
 * <p><a href="http://en.wikipedia.org/wiki/Interleaved_2_of_5">http://en.wikipedia.org/wiki/Interleaved_2_of_5</a>
 * is a great reference for Interleaved 2 of 5 information.</p>
 *
 * @author kevin.osullivan@sita.aero, SITA Lab.
 */
export default class ITFReader extends OneDReader {

  constructor() {
    super();
    // Stores the actual narrow line width of the image being decoded.
    this.narrowLineWidth = -1;
  }

  decodeRow(rowNumber, row, hints) {

    // Find out where the Middle section (payload) starts & ends
    const startRange = this.decodeStart(row);
    const endRange = this.decodeEnd(row);

    const result = [];
    ITFReader.decodeMiddle(row, startRange[1], endRange[0], result);
    const resultString = result.join('');

    let allowedLengths;
    if (hints) {
      allowedLengths = hints[DecodeHintType.ALLOWED_LENGTHS];
    }
    if (!allowedLengths) {
      allowedLengths = DEFAULT_ALLOWED_LENGTHS;
    }

    // To avoid false positives with 2D barcodes (and other patterns), make
    // an assumption that the decoded string must be a 'standard' length if it's short
    const length = resultString.length;
    let maxAllowedLength = 0;
    let lengthOK = allowedLengths.some((allowedLength) => {
      if (length === allowedLength) {
        return true;
      }
      if (allowedLength > maxAllowedLength) {
        maxAllowedLength = allowedLength;
      }
    });
    if (!lengthOK && length > maxAllowedLength) {
      lengthOK = true;
    }
    if (!lengthOK) {
      throw FormatException.getFormatInstance();
    }

    return new Result(
      resultString,
      null, // no natural byte representation for these barcodes
      [
        new ResultPoint(startRange[1], rowNumber),
        new ResultPoint(endRange[0], rowNumber)
      ],
      BarcodeFormat.ITF);
  }

  /**
   * @param row          row of black/white values to search
   * @param payloadStart offset of start pattern
   * @param resultString {@link StringBuilder} to append decoded chars to
   * @throws NotFoundException if decoding could not complete successfully
   */
  static decodeMiddle(row, payloadStart, payloadEnd, resultString) {

    // Digits are interleaved in pairs - 5 black lines for one digit, and the
    // 5
    // interleaved white lines for the second digit.
    // Therefore, need to scan 10 lines and then
    // split these into two arrays
    const counterDigitPair = new Int32Array(10);
    const counterBlack = new Int32Array(5);
    const counterWhite = new Int32Array(5);

    while (payloadStart < payloadEnd) {

      // Get 10 runs of black/white.
      ITFReader.recordPattern(row, payloadStart, counterDigitPair);
      // Split them into each array
      for (let k = 0; k < 5; k++) {
        const twoK = 2 * k;
        counterBlack[k] = counterDigitPair[twoK];
        counterWhite[k] = counterDigitPair[twoK + 1];
      }

      let bestMatch = ITFReader.decodeDigit(counterBlack);
      resultString.push(String.fromCharCode(48 + bestMatch));
      bestMatch = ITFReader.decodeDigit(counterWhite);
      resultString.push(String.fromCharCode(48 + bestMatch));

      counterDigitPair.forEach((counterDigit) => {
        payloadStart += counterDigit;
      });
    }
  }

  /**
   * Identify where the start of the middle / payload section starts.
   *
   * @param row row of black/white values to search
   * @return Array, containing index of start of 'start block' and end of
   *         'start block'
   * @throws NotFoundException
   */
  decodeStart(row) {
    const endStart = ITFReader.skipWhiteSpace(row);
    const startPattern = ITFReader.findGuardPattern(row, endStart, START_PATTERN);

    // Determine the width of a narrow line in pixels. We can do this by
    // getting the width of the start pattern and dividing by 4 because its
    // made up of 4 narrow lines.
    this.narrowLineWidth = Math.floor((startPattern[1] - startPattern[0]) / 4);

    this.validateQuietZone(row, startPattern[0]);

    return startPattern;
  }

  /**
   * The start & end patterns must be pre/post fixed by a quiet zone. This
   * zone must be at least 10 times the width of a narrow line.  Scan back until
   * we either get to the start of the barcode or match the necessary number of
   * quiet zone pixels.
   *
   * Note: Its assumed the row is reversed when using this method to find
   * quiet zone after the end pattern.
   *
   * ref: http://www.barcode-1.net/i25code.html
   *
   * @param row bit array representing the scanned barcode.
   * @param startPattern index into row of the start or end pattern.
   * @throws NotFoundException if the quiet zone cannot be found, a ReaderException is thrown.
   */
  validateQuietZone(row, startPattern) {

    let quietCount = this.narrowLineWidth * 10; // expect to find this many pixels of quiet zone

    // if there are not so many pixel at all let's try as many as possible
    quietCount = quietCount < startPattern ? quietCount : startPattern;

    for (let i = startPattern - 1; quietCount > 0 && i >= 0; i--) {
      if (row.get(i)) {
        break;
      }
      quietCount--;
    }
    if (quietCount !== 0) {
      // Unable to find the necessary number of quiet zone pixels.
      throw NotFoundException.getNotFoundInstance();
    }
  }

  /**
   * Skip all whitespace until we get to the first black line.
   *
   * @param row row of black/white values to search
   * @return index of the first black line.
   * @throws NotFoundException Throws exception if no black lines are found in the row
   */
  static skipWhiteSpace(row) {
    const width = row.getSize();
    const endStart = row.getNextSet(0);
    if (endStart === width) {
      throw NotFoundException.getNotFoundInstance();
    }

    return endStart;
  }

  /**
   * Identify where the end of the middle / payload section ends.
   *
   * @param row row of black/white values to search
   * @return Array, containing index of start of 'end block' and end of 'end
   *         block'
   * @throws NotFoundException
   */
  decodeEnd(row) {

    // For convenience, reverse the row and then
    // search from 'the start' for the end block
    row.reverse();
    try {
      const endStart = ITFReader.skipWhiteSpace(row);
      const endPattern = ITFReader.findGuardPattern(row, endStart, END_PATTERN_REVERSED);

      // The start & end patterns must be pre/post fixed by a quiet zone. This
      // zone must be at least 10 times the width of a narrow line.
      // ref: http://www.barcode-1.net/i25code.html
      this.validateQuietZone(row, endPattern[0]);

      // Now recalculate the indices of where the 'endblock' starts & stops to
      // accommodate
      // the reversed nature of the search
      const temp = endPattern[0];
      endPattern[0] = row.getSize() - endPattern[1];
      endPattern[1] = row.getSize() - temp;

      return endPattern;
    }
    finally {
      // Put the row back the right way.
      row.reverse();
    }
  }

  /**
   * @param row       row of black/white values to search
   * @param rowOffset position to start search
   * @param pattern   pattern of counts of number of black and white pixels that are
   *                  being searched for as a pattern
   * @return start/end horizontal offset of guard pattern, as an array of two
   *         ints
   * @throws NotFoundException if pattern is not found
   */
  static findGuardPattern(row, rowOffset, pattern) {
    const patternLength = pattern.length;
    const counters = new Int32Array(patternLength);
    const width = row.getSize();
    let isWhite = false;

    let counterPosition = 0;
    let patternStart = rowOffset;
    for (let x = rowOffset; x < width; x++) {
      if (row.get(x) ^ isWhite) {
        counters[counterPosition]++;
      }
      else {
        if (counterPosition === patternLength - 1) {
          if (ITFReader.patternMatchVariance(counters, pattern, MAX_INDIVIDUAL_VARIANCE) < MAX_AVG_VARIANCE) {
            return [patternStart, x];
          }
          patternStart += counters[0] + counters[1];
          for (let i = 0; i < patternLength - 2; i++) {
            counters[i] = counters[i + 2];
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

  /**
   * Attempts to decode a sequence of ITF black/white lines into single
   * digit.
   *
   * @param counters the counts of runs of observed black/white/black/... values
   * @return The decoded digit
   * @throws NotFoundException if digit cannot be decoded
   */
  static decodeDigit(counters) {
    let bestVariance = MAX_AVG_VARIANCE; // worst variance we'll accept
    let bestMatch = -1;
    const max = PATTERNS.length;
    for (let i = 0; i < max; i++) {
      const pattern = PATTERNS[i];
      const variance = ITFReader.patternMatchVariance(counters, pattern, MAX_INDIVIDUAL_VARIANCE);
      if (variance < bestVariance) {
        bestVariance = variance;
        bestMatch = i;
      }
    }
    if (bestMatch >= 0) {
      return bestMatch;
    }
    else {
      throw NotFoundException.getNotFoundInstance();
    }
  }

}
