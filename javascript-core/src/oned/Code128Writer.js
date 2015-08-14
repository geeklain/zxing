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
import { CODE_PATTERNS } from './Code128Reader';
import BarcodeFormat from '../BarcodeFormat';
import IllegalArgumentException from '../IllegalArgumentException';

const CODE_START_B = 104;
const CODE_START_C = 105;
const CODE_CODE_B = 100;
const CODE_CODE_C = 99;
const CODE_STOP = 106;

// Dummy characters used to specify control characters in input
const ESCAPE_FNC_1 = '\u00f1';
const ESCAPE_FNC_2 = '\u00f2';
const ESCAPE_FNC_3 = '\u00f3';
const ESCAPE_FNC_4 = '\u00f4';

const CODE_FNC_1 = 102;   // Code A, Code B, Code C
const CODE_FNC_2 = 97;    // Code A, Code B
const CODE_FNC_3 = 96;    // Code A, Code B
const CODE_FNC_4_B = 100; // Code B

/**
 * This object renders a CODE128 code as a {@link BitMatrix}.
 * 
 * @author erik.barbara@gmail.com (Erik Barbara)
 */
export default class Code128Writer extends OneDimensionalCodeWriter {

  encode(contents, format, width, height, hints) {

    if (format !== BarcodeFormat.CODE_128) {
      throw new IllegalArgumentException('Can only encode CODE_128, but got ' + format);
    }
    return super.encode(contents, format, width, height, hints);
  }

  doEncode(contents) {

    const length = contents.length;
    // Check length
    if (length < 1 || length > 80) {
      throw new IllegalArgumentException(
          'Contents length should be between 1 and 80 characters, but got ' + length);
    }
    // Check content
    for (let i = 0; i < length; i++) {
      const c = contents.charAt(i);
      if (c < ' ' || c > '~') {
        switch (c) {
          case ESCAPE_FNC_1:
          case ESCAPE_FNC_2:
          case ESCAPE_FNC_3:
          case ESCAPE_FNC_4:
            break;
          default:
            throw new IllegalArgumentException('Bad character in input: ' + c);
        }
      }
    }
    
    const patterns = []; // temporary storage for patterns
    let checkSum = 0;
    let checkWeight = 1;
    let codeSet = 0; // selected code (CODE_CODE_B or CODE_CODE_C)
    let position = 0; // position in contents
    
    while (position < length) {
      //Select code to use
      const requiredDigitCount = codeSet === CODE_CODE_C ? 2 : 4;
      let newCodeSet;
      if (Code128Writer.isDigits(contents, position, requiredDigitCount)) {
        newCodeSet = CODE_CODE_C;
      } else {
        newCodeSet = CODE_CODE_B;
      }
      
      //Get the pattern index
      let patternIndex;
      if (newCodeSet === codeSet) {
        // Encode the current character
        // First handle escapes
        switch (contents.charAt(position)) {
          case ESCAPE_FNC_1:
            patternIndex = CODE_FNC_1;
            break;
          case ESCAPE_FNC_2:
            patternIndex = CODE_FNC_2;
            break;
          case ESCAPE_FNC_3:
            patternIndex = CODE_FNC_3;
            break;
          case ESCAPE_FNC_4:
            patternIndex = CODE_FNC_4_B; // FIXME if this ever outputs Code A
            break;
          default:
            // Then handle normal characters otherwise
            if (codeSet === CODE_CODE_B) {
              patternIndex = contents.charCodeAt(position) - 32;
            } else { // CODE_CODE_C
              patternIndex = parseInt(contents.substring(position, position + 2));
              position++; // Also incremented below
            }
        }
        position++;
      } else {
        // Should we change the current code?
        // Do we have a code set?
        if (codeSet === 0) {
          // No, we don't have a code set
          if (newCodeSet === CODE_CODE_B) {
            patternIndex = CODE_START_B;
          } else {
            // CODE_CODE_C
            patternIndex = CODE_START_C;
          }
        } else {
          // Yes, we have a code set
          patternIndex = newCodeSet;
        }
        codeSet = newCodeSet;
      }
      
      // Get the pattern
      patterns.push(CODE_PATTERNS[patternIndex]);
      
      // Compute checksum
      checkSum += patternIndex * checkWeight;
      if (position != 0) {
        checkWeight++;
      }
    }
    
    // Compute and append checksum
    checkSum %= 103;
    patterns.push(CODE_PATTERNS[checkSum]);
    
    // Append stop code
    patterns.push(CODE_PATTERNS[CODE_STOP]);
    
    // Compute code width
    let codeWidth = 0;
    patterns.forEach(function(pattern) {
      pattern.forEach(function(width) {
        codeWidth += width;
      });
    });
    
    // Compute result
    const result = new Array(codeWidth);
    let pos = 0;
    patterns.forEach(function(pattern) {
      pos += Code128Writer.appendPattern(result, pos, pattern, true);
    });
    
    return result;
  }

  static isDigits(value, start, length) {
    let end = start + length;
    const last = value.length;
    for (let i = start; i < end && i < last; i++) {
      const c = value.charAt(i);
      if (c < '0' || c > '9') {
        if (c !== ESCAPE_FNC_1) {
          return false;
        }
        end++; // ignore FNC_1
      }
    }
    return end <= last; // end > last if we've run out of string
  }
}