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
import FormatException from '../FormatException';
import NotFoundException from '../NotFoundException';
import ChecksumException from '../ChecksumException';
import DecodeHintType from '../DecodeHintType';
import BarcodeFormat from '../BarcodeFormat';
import ResultPoint from '../ResultPoint';
import Result from '../Result';

const CODE_PATTERNS = [
  [2, 1, 2, 2, 2, 2], // 0
  [2, 2, 2, 1, 2, 2],
  [2, 2, 2, 2, 2, 1],
  [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2],
  [1, 3, 1, 2, 2, 2], // 5
  [1, 2, 2, 2, 1, 3],
  [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2],
  [2, 2, 1, 2, 1, 3],
  [2, 2, 1, 3, 1, 2], // 10
  [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2],
  [1, 2, 2, 1, 3, 2],
  [1, 2, 2, 2, 3, 1],
  [1, 1, 3, 2, 2, 2], // 15
  [1, 2, 3, 1, 2, 2],
  [1, 2, 3, 2, 2, 1],
  [2, 2, 3, 2, 1, 1],
  [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], // 20
  [2, 1, 3, 2, 1, 2],
  [2, 2, 3, 1, 1, 2],
  [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2],
  [3, 2, 1, 1, 2, 2], // 25
  [3, 2, 1, 2, 2, 1],
  [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2],
  [3, 2, 2, 2, 1, 1],
  [2, 1, 2, 1, 2, 3], // 30
  [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1],
  [1, 1, 1, 3, 2, 3],
  [1, 3, 1, 1, 2, 3],
  [1, 3, 1, 3, 2, 1], // 35
  [1, 1, 2, 3, 1, 3],
  [1, 3, 2, 1, 1, 3],
  [1, 3, 2, 3, 1, 1],
  [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], // 40
  [2, 3, 1, 3, 1, 1],
  [1, 1, 2, 1, 3, 3],
  [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1],
  [1, 1, 3, 1, 2, 3], // 45
  [1, 1, 3, 3, 2, 1],
  [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1],
  [2, 1, 1, 3, 3, 1],
  [2, 3, 1, 1, 3, 1], // 50
  [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1],
  [2, 1, 3, 1, 3, 1],
  [3, 1, 1, 1, 2, 3],
  [3, 1, 1, 3, 2, 1], // 55
  [3, 3, 1, 1, 2, 1],
  [3, 1, 2, 1, 1, 3],
  [3, 1, 2, 3, 1, 1],
  [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], // 60
  [2, 2, 1, 4, 1, 1],
  [4, 3, 1, 1, 1, 1],
  [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2],
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1],
  [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1],
  [1, 1, 2, 2, 1, 4],
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1],
  [1, 4, 2, 1, 1, 2],
  [1, 4, 2, 2, 1, 1],
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4],
  [4, 1, 3, 1, 1, 1],
  [2, 4, 1, 1, 1, 2],
  [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2],
  [1, 2, 1, 2, 4, 1],
  [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2],
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2],
  [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1],
  [2, 1, 2, 1, 4, 1],
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3],
  [1, 1, 1, 3, 4, 1],
  [1, 3, 1, 1, 4, 1],
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1],
  [4, 1, 1, 1, 1, 3],
  [4, 1, 1, 3, 1, 1],
  [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1],
  [4, 1, 1, 1, 3, 1],
  [2, 1, 1, 4, 1, 2],
  [2, 1, 1, 2, 1, 4],
  [2, 1, 1, 2, 3, 2], // 105
  [2, 3, 3, 1, 1, 1, 2]
];

const MAX_AVG_VARIANCE = 0.25;
const MAX_INDIVIDUAL_VARIANCE = 0.7;

const CODE_SHIFT = 98;

const CODE_CODE_C = 99;
const CODE_CODE_B = 100;
const CODE_CODE_A = 101;

const CODE_FNC_1 = 102;
const CODE_FNC_2 = 97;
const CODE_FNC_3 = 96;
const CODE_FNC_4_A = 101;
const CODE_FNC_4_B = 100;

const CODE_START_A = 103;
const CODE_START_B = 104;
const CODE_START_C = 105;
const CODE_STOP = 106;

/**
 * <p>Decodes Code 128 barcodes.</p>
 *
 * @author Sean Owen
 */
export default class Code128Reader extends OneDReader {

  static findStartPattern(row) {
    const width = row.getSize();
    const rowOffset = row.getNextSet(0);

    let counterPosition = 0;
    const counters = Array.apply(null, Array(6)).map(function () {
      return 0;
    });
    let patternStart = rowOffset;
    let isWhite = false;
    const patternLength = 6;

    for (let i = rowOffset; i < width; i++) {
      if (row.get(i) ^ isWhite) {
        counters[counterPosition]++;
      } else {
        if (counterPosition === patternLength - 1) {
          let bestVariance = MAX_AVG_VARIANCE;
          let bestMatch = -1;
          for (let startCode = CODE_START_A; startCode <= CODE_START_C; startCode++) {
            const variance = Code128Reader.patternMatchVariance(counters, CODE_PATTERNS[startCode],
                                                                MAX_INDIVIDUAL_VARIANCE);
            if (variance < bestVariance) {
              bestVariance = variance;
              bestMatch = startCode;
            }
          }
          // Look for whitespace before start pattern, >= 50% of width of start pattern
          if (bestMatch >= 0
              && row.isRange(Math.max(0, patternStart - (i - patternStart) / 2), patternStart, false)) {
            return [patternStart, i, bestMatch];
          }
          patternStart += counters[0] + counters[1];
          for (let k = 0; k < patternLength - 2; k++) {
            counters[k] = counters[k + 2];
          }
          counters[patternLength - 2] = 0;
          counters[patternLength - 1] = 0;
          counterPosition--;
        } else {
          counterPosition++;
        }
        counters[counterPosition] = 1;
        isWhite = !isWhite;
      }
    }
    throw NotFoundException.getNotFoundInstance();
  }

  static decodeCode(row, counters, rowOffset) {
    Code128Reader.recordPattern(row, rowOffset, counters);
    let bestVariance = MAX_AVG_VARIANCE; // worst variance we'll accept
    let bestMatch = -1;
    for (let d = 0; d < CODE_PATTERNS.length; d++) {
      const pattern = CODE_PATTERNS[d];
      const variance = Code128Reader.patternMatchVariance(counters, pattern, MAX_INDIVIDUAL_VARIANCE);
      if (variance < bestVariance) {
        bestVariance = variance;
        bestMatch = d;
      }
    }
    // TODO We're overlooking the fact that the STOP pattern has 7 values, not 6.
    if (bestMatch >= 0) {
      return bestMatch;
    } else {
      throw NotFoundException.getNotFoundInstance();
    }
  }

  decodeRow(rowNumber, row, hints) {

    const convertFNC1 = hints && hints[DecodeHintType.ASSUME_GS1];

    const startPatternInfo = Code128Reader.findStartPattern(row);
    const startCode = startPatternInfo[2];

    const rawCodes = [];
    rawCodes.push(startCode);

    let codeSet;
    switch (startCode) {
      case CODE_START_A:
        codeSet = CODE_CODE_A;
        break;
      case CODE_START_B:
        codeSet = CODE_CODE_B;
        break;
      case CODE_START_C:
        codeSet = CODE_CODE_C;
        break;
      default:
        throw FormatException.getFormatInstance();
    }

    let done = false;
    let isNextShifted = false;

    const result = [];

    let lastStart = startPatternInfo[0];
    let nextStart = startPatternInfo[1];
    const counters = Array.apply(null, Array(6)).map(function () {
      return 0;
    });

    let lastCode = 0;
    let code = 0;
    let checksumTotal = startCode;
    let multiplier = 0;
    let lastCharacterWasPrintable = true;
    let upperMode = false;
    let shiftUpperMode = false;

    while (!done) {

      const unshift = isNextShifted;
      isNextShifted = false;

      // Save off last code
      lastCode = code;

      // Decode another code from image
      code = Code128Reader.decodeCode(row, counters, nextStart);

      rawCodes.push(code);

      // Remember whether the last code was printable or not (excluding CODE_STOP)
      if (code !== CODE_STOP) {
        lastCharacterWasPrintable = true;
      }

      // Add to checksum computation (if not CODE_STOP of course)
      if (code !== CODE_STOP) {
        multiplier++;
        checksumTotal += multiplier * code;
      }

      // Advance to where the next code will to start
      lastStart = nextStart;
      counters.forEach(function (counter) {
        nextStart += counter;
      });

      // Take care of illegal start codes
      switch (code) {
        case CODE_START_A:
        case CODE_START_B:
        case CODE_START_C:
          throw FormatException.getFormatInstance();
      }

      switch (codeSet) {

        case CODE_CODE_A:
          if (code < 64) {
            if (shiftUpperMode === upperMode) {
              result.push(String.fromCharCode(code + 32));
            } else {
              result.push(String.fromCharCode(code + 32 + 128));
            }
            shiftUpperMode = false;
          } else if (code < 96) {
            if (shiftUpperMode == upperMode) {
              result.push(String.fromCharCode(code - 64));
            } else {
              result.push(String.fromCharCode(code + 64));
            }
            shiftUpperMode = false;
          } else {
            // Don't let CODE_STOP, which always appears, affect whether whether we think the last
            // code was printable or not.
            if (code != CODE_STOP) {
              lastCharacterWasPrintable = false;
            }
            switch (code) {
              case CODE_FNC_1:
                if (convertFNC1) {
                  if (result.length === 0) {
                    // GS1 specification 5.4.3.7. and 5.4.6.4. If the first char after the start code
                    // is FNC1 then this is GS1-128. We add the symbology identifier.
                    result.push(']C1');
                  } else {
                    // GS1 specification 5.4.7.5. Every subsequent FNC1 is returned as ASCII 29 (GS)
                    result.push(String.fromCharCode(29));
                  }
                }
                break;
              case CODE_FNC_2:
              case CODE_FNC_3:
                // do nothing?
                break;
              case CODE_FNC_4_A:
                if (!upperMode && shiftUpperMode) {
                  upperMode = true;
                  shiftUpperMode = false;
                } else if (upperMode && shiftUpperMode) {
                  upperMode = false;
                  shiftUpperMode = false;
                } else {
                  shiftUpperMode = true;
                }
                break;
              case CODE_SHIFT:
                isNextShifted = true;
                codeSet = CODE_CODE_B;
                break;
              case CODE_CODE_B:
                codeSet = CODE_CODE_B;
                break;
              case CODE_CODE_C:
                codeSet = CODE_CODE_C;
                break;
              case CODE_STOP:
                done = true;
                break;
            }
          }
          break;
        case CODE_CODE_B:
          if (code < 96) {
            if (shiftUpperMode === upperMode) {
              result.push(String.fromCharCode(code + 32));
            } else {
              result.push(String.fromCharCode(code + 32 + 128));
            }
            shiftUpperMode = false;
          } else {
            if (code !== CODE_STOP) {
              lastCharacterWasPrintable = false;
            }
            switch (code) {
              case CODE_FNC_1:
                if (convertFNC1) {
                  if (result.length === 0) {
                    // GS1 specification 5.4.3.7. and 5.4.6.4. If the first char after the start code
                    // is FNC1 then this is GS1-128. We add the symbology identifier.
                    result.push(']C1');
                  } else {
                    // GS1 specification 5.4.7.5. Every subsequent FNC1 is returned as ASCII 29 (GS)
                    result.push(String.fromCharCode(29));
                  }
                }
                break;
              case CODE_FNC_2:
              case CODE_FNC_3:
                // do nothing?
                break;
              case CODE_FNC_4_B:
                if (!upperMode && shiftUpperMode) {
                  upperMode = true;
                  shiftUpperMode = false;
                } else if (upperMode && shiftUpperMode) {
                  upperMode = false;
                  shiftUpperMode = false;
                } else {
                  shiftUpperMode = true;
                }
                break;
              case CODE_SHIFT:
                isNextShifted = true;
                codeSet = CODE_CODE_A;
                break;
              case CODE_CODE_A:
                codeSet = CODE_CODE_A;
                break;
              case CODE_CODE_C:
                codeSet = CODE_CODE_C;
                break;
              case CODE_STOP:
                done = true;
                break;
            }
          }
          break;
        case CODE_CODE_C:
          if (code < 100) {
            if (code < 10) {
              result.push('0');
            }
            result.push(code);
          } else {
            if (code !== CODE_STOP) {
              lastCharacterWasPrintable = false;
            }
            switch (code) {
              case CODE_FNC_1:
                if (convertFNC1) {
                  if (result.length === 0) {
                    // GS1 specification 5.4.3.7. and 5.4.6.4. If the first char after the start code
                    // is FNC1 then this is GS1-128. We add the symbology identifier.
                    result.push(']C1');
                  } else {
                    // GS1 specification 5.4.7.5. Every subsequent FNC1 is returned as ASCII 29 (GS)
                    result.push(String.fromCharCode(29));
                  }
                }
                break;
              case CODE_CODE_A:
                codeSet = CODE_CODE_A;
                break;
              case CODE_CODE_B:
                codeSet = CODE_CODE_B;
                break;
              case CODE_STOP:
                done = true;
                break;
            }
          }
          break;
      }

      // Unshift back to another code set if we were shifted
      if (unshift) {
        codeSet = codeSet === CODE_CODE_A ? CODE_CODE_B : CODE_CODE_A;
      }

    }

    const lastPatternSize = nextStart - lastStart;

    // Check for ample whitespace following pattern, but, to do this we first need to remember that
    // we fudged decoding CODE_STOP since it actually has 7 bars, not 6. There is a black bar left
    // to read off. Would be slightly better to properly read. Here we just skip it:
    nextStart = row.getNextUnset(nextStart);
    if (!row.isRange(nextStart,
                     Math.min(row.getSize(), nextStart + (nextStart - lastStart) / 2),
                     false)) {
      throw NotFoundException.getNotFoundInstance();
    }

    // Pull out from sum the value of the penultimate check code
    checksumTotal -= multiplier * lastCode;
    // lastCode is the checksum then:
    if (checksumTotal % 103 != lastCode) {
      throw ChecksumException.getChecksumInstance();
    }

    // Need to pull out the check digits from string
    const resultLength = result.length;
    if (resultLength == 0) {
      // false positive
      throw NotFoundException.getNotFoundInstance();
    }

    // Only bother if the result had at least one character, and if the checksum digit happened to
    // be a printable character. If it was just interpreted as a control code, nothing to remove.
    if (resultLength > 0 && lastCharacterWasPrintable) {
      result.splice(resultLength - 1, 1);
    }

    const left = (startPatternInfo[1] + startPatternInfo[0]) / 2.0;
    const right = lastStart + lastPatternSize / 2.0;

    return new Result(
      result.join(''),
      rawCodes,
      [
        new ResultPoint(left, rowNumber),
        new ResultPoint(right, rowNumber)
      ],
      BarcodeFormat.CODE_128);

  }

}
