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

import IllegalArgumentException from '../../IllegalArgumentException';

/**
 * <p>See ISO 18004:2006, 6.4.1, Tables 2 and 3. This enum encapsulates the various modes in which
 * data can be encoded to bits in the QR code standard.</p>
 *
 * @author Sean Owen
 */
export default class Mode {

  constructor(characterCountBitsForVersions, bits) {
    this.characterCountBitsForVersions = characterCountBitsForVersions;
    this.bits = bits;
  }

  /**
   * @param bits four bits encoding a QR Code data mode
   * @return Mode encoded by these bits
   * @throws IllegalArgumentException if bits do not correspond to a known mode
   */
  static forBits(bits) {
    switch (bits) {
      case 0x0:
        return Mode.TERMINATOR;
      case 0x1:
        return Mode.NUMERIC;
      case 0x2:
        return Mode.ALPHANUMERIC;
      case 0x3:
        return Mode.STRUCTURED_APPEND;
      case 0x4:
        return Mode.BYTE;
      case 0x5:
        return Mode.FNC1_FIRST_POSITION;
      case 0x7:
        return Mode.ECI;
      case 0x8:
        return Mode.KANJI;
      case 0x9:
        return Mode.FNC1_SECOND_POSITION;
      case 0xD:
        // 0xD is defined in GBT 18284-2000, may not be supported in foreign country
        return Mode.HANZI;
      default:
        throw new IllegalArgumentException();
    }
  }

  /**
   * @param version version in question
   * @return number of bits used, in this QR Code symbol {@link Version}, to encode the
   *         count of characters that will follow encoded in this Mode
   */
  getCharacterCountBits(version) {
    const number = version.getVersionNumber();
    let offset;
    if (number <= 9) {
      offset = 0;
    }
    else if (number <= 26) {
      offset = 1;
    }
    else {
      offset = 2;
    }
    return this.characterCountBitsForVersions[offset];
  }

  getBits() {
    return this.bits;
  }
}

Mode.TERMINATOR = new Mode([0, 0, 0], 0x00); // Not really a mode...
Mode.NUMERIC = new Mode([10, 12, 14], 0x01);
Mode.ALPHANUMERIC = new Mode([9, 11, 13], 0x02);
Mode.STRUCTURED_APPEND = new Mode([0, 0, 0], 0x03); // Not supported
Mode.BYTE = new Mode([8, 16, 16], 0x04);
Mode.ECI = new Mode([0, 0, 0], 0x07); // character counts don't apply
Mode.KANJI = new Mode([8, 10, 12], 0x08);
Mode.FNC1_FIRST_POSITION = new Mode([0, 0, 0], 0x05);
Mode.FNC1_SECOND_POSITION = new Mode([0, 0, 0], 0x09);
/** See GBT 18284-2000; "Hanzi" is a transliteration of this mode name. */
Mode.HANZI = new Mode([8, 10, 12], 0x0D);
