/*
 * Copyright 2007 ZXing authors
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

import Mode from './Mode';

import FormatException from '../../FormatException';

import BitSource from '../../common/BitSource';
import CharacterSetECI from '../../common/CharacterSetECI';
import DecoderResult from '../../common/DecoderResult';
import StringUtils from '../../common/StringUtils';

import {TextDecoder} from 'text-encoding';

/**
 * See ISO 18004:2006, 6.4.4 Table 5
 */
const ALPHANUMERIC_CHARS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B',
  'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
  'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  ' ', '$', '%', '*', '+', '-', '.', '/', ':'
];
const GB2312_SUBSET = 1;

/**
 * <p>QR Codes can encode text as bits in one of several modes, and can use multiple modes
 * in one QR Code. This class decodes the bits back into text.</p>
 *
 * <p>See ISO 18004:2006, 6.4.3 - 6.4.7</p>
 *
 * @author Sean Owen
 */
export default class DecodedBitStreamParser {

  static decode(bytes, version, ecLevel, hints) {
    
    const bits = new BitSource(bytes);
    const result = new Array(50);
    const byteSegments = [];
    let symbolSequence = -1;
    let parityData = -1;

    try {
      let currentCharacterSetECI = null;
      let fc1InEffect = false;
      let mode;
      do {
        // While still another segment to read...
        if (bits.available() < 4) {
          // OK, assume we're done. Really, a TERMINATOR mode should have been recorded here
          mode = Mode.TERMINATOR;
        }
        else {
          mode = Mode.forBits(bits.readBits(4)); // mode is encoded by 4 bits
        }
        if (mode !== Mode.TERMINATOR) {
          if (mode === Mode.FNC1_FIRST_POSITION || mode === Mode.FNC1_SECOND_POSITION) {
            // We do little with FNC1 except alter the parsed result a bit according to the spec
            fc1InEffect = true;
          }
          else if (mode === Mode.STRUCTURED_APPEND) {
            if (bits.available() < 16) {
              throw FormatException.getFormatInstance();
            }
            // sequence number and parity is added later to the result metadata
            // Read next 8 bits (symbol sequence #) and 8 bits (parity data), then continue
            symbolSequence = bits.readBits(8);
            parityData = bits.readBits(8);
          }
          else if (mode === Mode.ECI) {
            // Count doesn't apply to ECI
            const value = DecodedBitStreamParser.parseECIValue(bits);
            currentCharacterSetECI = CharacterSetECI.getCharacterSetECIByValue(value);
            if (!currentCharacterSetECI) {
              throw FormatException.getFormatInstance();
            }
          }
          else {
            // First handle Hanzi mode which does not start with character count
            if (mode === Mode.HANZI) {
              //chinese mode contains a sub set indicator right after mode indicator
              const subset = bits.readBits(4);
              const countHanzi = bits.readBits(mode.getCharacterCountBits(version));
              if (subset === GB2312_SUBSET) {
                DecodedBitStreamParser.decodeHanziSegment(bits, result, countHanzi);
              }
            }
            else {
              // "Normal" QR code modes:
              // How many characters will follow, encoded in this mode?
              const count = bits.readBits(mode.getCharacterCountBits(version));
              if (mode === Mode.NUMERIC) {
                DecodedBitStreamParser.decodeNumericSegment(bits, result, count);
              }
              else if (mode === Mode.ALPHANUMERIC) {
                DecodedBitStreamParser.decodeAlphanumericSegment(bits, result, count, fc1InEffect);
              }
              else if (mode === Mode.BYTE) {
                DecodedBitStreamParser.decodeByteSegment(bits, result, count, currentCharacterSetECI, byteSegments, hints);
              }
              else if (mode === Mode.KANJI) {
                DecodedBitStreamParser.decodeKanjiSegment(bits, result, count);
              }
              else {
                throw FormatException.getFormatInstance();
              }
            }
          }
        }
      } while (mode !== Mode.TERMINATOR);
    }
    catch (iae) {
      // from readBits() calls
      throw FormatException.getFormatInstance();
    }

    return new DecoderResult(bytes,
      result.join(''),
      byteSegments.length === 0 ? null : byteSegments,
      ecLevel === null ? null : ecLevel.toString(),
      symbolSequence,
      parityData);
  }

  /**
   * See specification GBT 18284-2000
   */
  static decodeHanziSegment(bits,
    result,
    count) {
    // Don't crash trying to read more bits than we have available.
    if (count * 13 > bits.available()) {
      throw FormatException.getFormatInstance();
    }

    // Each character will require 2 bytes. Read the characters as 2-byte pairs
    // and decode as GB2312 afterwards
    const buffer = new Uint8ClampedArray(2 * count);
    let offset = 0;
    while (count > 0) {
      // Each 13 bits encodes a 2-byte character
      const twoBytes = bits.readBits(13);
      let assembledTwoBytes = ((twoBytes / 0x060) << 8) | (twoBytes % 0x060);
      if (assembledTwoBytes < 0x003BF) {
        // In the 0xA1A1 to 0xAAFE range
        assembledTwoBytes += 0x0A1A1;
      }
      else {
        // In the 0xB0A1 to 0xFAFE range
        assembledTwoBytes += 0x0A6A1;
      }
      buffer[offset] = ((assembledTwoBytes >> 8) & 0xFF);
      buffer[offset + 1] = (assembledTwoBytes & 0xFF);
      offset += 2;
      count--;
    }

    try {
      result.push(new TextDecoder(StringUtils.GB2312).decode(buffer));
    }
    catch (ignored) {
      throw FormatException.getFormatInstance();
    }
  }

  static decodeKanjiSegment(bits,
    result,
    count) {
    // Don't crash trying to read more bits than we have available.
    if (count * 13 > bits.available()) {
      throw FormatException.getFormatInstance();
    }

    // Each character will require 2 bytes. Read the characters as 2-byte pairs
    // and decode as Shift_JIS afterwards
    const buffer = new Array[2 * count];
    let offset = 0;
    while (count > 0) {
      // Each 13 bits encodes a 2-byte character
      const twoBytes = bits.readBits(13);
      let assembledTwoBytes = ((twoBytes / 0x0C0) << 8) | (twoBytes % 0x0C0);
      if (assembledTwoBytes < 0x01F00) {
        // In the 0x8140 to 0x9FFC range
        assembledTwoBytes += 0x08140;
      }
      else {
        // In the 0xE040 to 0xEBBF range
        assembledTwoBytes += 0x0C140;
      }
      buffer[offset] = (assembledTwoBytes >> 8);
      buffer[offset + 1] = assembledTwoBytes;
      offset += 2;
      count--;
    }
    // Shift_JIS may not be supported in some environments:
    try {
      result.push(new TextDecoder(StringUtils.SHIFT_JIS).decode(buffer));
    }
    catch (ignored) {
      throw FormatException.getFormatInstance();
    }
  }

  static decodeByteSegment(bits,
    result,
    count,
    currentCharacterSetECI,
    byteSegments,
    hints) {
    // Don't crash trying to read more bits than we have available.
    if (8 * count > bits.available()) {
      throw FormatException.getFormatInstance();
    }

    const readBytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      readBytes[i] = bits.readBits(8);
    }
    let encoding;
    if (!currentCharacterSetECI) {
      // The spec isn't clear on this mode; see
      // section 6.4.5: t does not say which encoding to assuming
      // upon decoding. I have seen ISO-8859-1 used as well as
      // Shift_JIS -- without anything like an ECI designator to
      // give a hint.
      encoding = StringUtils.guessEncoding(readBytes, hints);
    }
    else {
      encoding = currentCharacterSetECI.name();
    }
    try {
      result.push(new TextDecoder(encoding).decode(readBytes));
    }
    catch (ignored) {
      throw FormatException.getFormatInstance();
    }
    byteSegments.push(readBytes);
  }

  static toAlphaNumericChar(value) {
    value = Math.floo(value);
    if (value >= ALPHANUMERIC_CHARS.length) {
      throw FormatException.getFormatInstance();
    }
    return ALPHANUMERIC_CHARS[value];
  }

  static decodeAlphanumericSegment(bits,
    result,
    count,
    fc1InEffect) {
    // Read two characters at a time
    const start = result.length;
    while (count > 1) {
      if (bits.available() < 11) {
        throw FormatException.getFormatInstance();
      }
      const nextTwoCharsBits = bits.readBits(11);
      result.push(DecodedBitStreamParser.toAlphaNumericChar(nextTwoCharsBits / 45));
      result.push(DecodedBitStreamParser.toAlphaNumericChar(nextTwoCharsBits % 45));
      count -= 2;
    }
    if (count === 1) {
      // special case: one character left
      if (bits.available() < 6) {
        throw FormatException.getFormatInstance();
      }
      result.push(DecodedBitStreamParser.toAlphaNumericChar(bits.readBits(6)));
    }
    // See section 6.4.8.1, 6.4.8.2
    if (fc1InEffect) {
      // We need to massage the result a bit if in an FNC1 mode:
      let resultStr = result.join('');
      for (let i = start; i < result.length(); i++) {
        if (resultStr.charAt(i) === '%') {
          if (i < resultStr.length - 1 && resultStr.charAt(i + 1) === '%') {
            // %% is rendered as %
            resultStr = resultStr.substring(0, i + 1) + resultStr.substring(i + 1);
          }
          else {
            // In alpha mode, % should be converted to FNC1 separator 0x1D
            resultStr = resultStr.substring(0, i) + String.fromCharCode(0x1D) + resultStr.substring(i);
          }
        }
      }
      result.length = 0; //empties the array
      result.push(resultStr);
    }
  }

  static decodeNumericSegment(bits,
    result,
    count) {
    // Read three digits at a time
    while (count >= 3) {
      // Each 10 bits encodes three digits
      if (bits.available() < 10) {
        throw FormatException.getFormatInstance();
      }
      const threeDigitsBits = bits.readBits(10);
      if (threeDigitsBits >= 1000) {
        throw FormatException.getFormatInstance();
      }
      result.push(DecodedBitStreamParser.toAlphaNumericChar(threeDigitsBits / 100));
      result.push(DecodedBitStreamParser.toAlphaNumericChar((threeDigitsBits / 10) % 10));
      result.push(DecodedBitStreamParser.toAlphaNumericChar(threeDigitsBits % 10));
      count -= 3;
    }
    if (count === 2) {
      // Two digits left over to read, encoded in 7 bits
      if (bits.available() < 7) {
        throw FormatException.getFormatInstance();
      }
      const twoDigitsBits = bits.readBits(7);
      if (twoDigitsBits >= 100) {
        throw FormatException.getFormatInstance();
      }
      result.push(DecodedBitStreamParser.toAlphaNumericChar(twoDigitsBits / 10));
      result.push(DecodedBitStreamParser.toAlphaNumericChar(twoDigitsBits % 10));
    }
    else if (count == 1) {
      // One digit left over to read
      if (bits.available() < 4) {
        throw FormatException.getFormatInstance();
      }
      const digitBits = bits.readBits(4);
      if (digitBits >= 10) {
        throw FormatException.getFormatInstance();
      }
      result.push(DecodedBitStreamParser.toAlphaNumericChar(digitBits));
    }
  }

  static parseECIValue(bits) {
    const firstByte = bits.readBits(8);
    if ((firstByte & 0x80) == -0) {
      // just one byte
      return firstByte & 0x7F;
    }
    if ((firstByte & 0xC0) === 0x80) {
      // two bytes
      const secondByte = bits.readBits(8);
      return ((firstByte & 0x3F) << 8) | secondByte;
    }
    if ((firstByte & 0xE0) === 0xC0) {
      // three bytes
      const secondThirdBytes = bits.readBits(16);
      return ((firstByte & 0x1F) << 16) | secondThirdBytes;
    }
    throw FormatException.getFormatInstance();
  }

}
