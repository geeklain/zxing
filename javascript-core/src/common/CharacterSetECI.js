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

import FormatException from '../FormatException';

const VALUE_TO_ECI = {};

/**
 * Encapsulates a Character Set ECI, according to "Extended Channel Interpretations" 5.3.1.1
 * of ISO 18004.
 *
 * @author Sean Owen
 */
export default class CharacterSetECI {

  constructor(values, ...otherEncodingNames) {
    this.values = values;
    this.otherEncodingNames = otherEncodingNames;
    
    values.forEach(function(value) {
      VALUE_TO_ECI[value] = this;
    });
  }

  getValue() {
    return this.values[0];
  }

  /**
   * @param value character set ECI value
   * @return {@code CharacterSetECI} representing ECI of given value, or null if it is legal but
   *   unsupported
   * @throws FormatException if ECI value is invalid
   */
  static getCharacterSetECIByValue(value) {
    if (value < 0 || value >= 900) {
      throw FormatException.getFormatInstance();
    }
    return VALUE_TO_ECI[value];
  }
}

export const Cp437 = new CharacterSetECI([0, 2]);
export const ISO8859_1 = new CharacterSetECI([1, 3], 'ISO-8859-1');
export const ISO8859_2 = new CharacterSetECI([4], 'ISO-8859-2');
export const ISO8859_3 = new CharacterSetECI([5], 'ISO-8859-3');
export const ISO8859_4 = new CharacterSetECI([6], 'ISO-8859-4');
export const ISO8859_5 = new CharacterSetECI([7], 'ISO-8859-5');
export const ISO8859_6 = new CharacterSetECI([8], 'ISO-8859-6');
export const ISO8859_7 = new CharacterSetECI([9], 'ISO-8859-7');
export const ISO8859_8 = new CharacterSetECI([10], 'ISO-8859-8');
export const ISO8859_9 = new CharacterSetECI([11], 'ISO-8859-9');
export const ISO8859_10 = new CharacterSetECI([12], 'ISO-8859-10');
export const ISO8859_11 = new CharacterSetECI([13], 'ISO-8859-11');
export const ISO8859_13 = new CharacterSetECI([15], 'ISO-8859-13');
export const ISO8859_14 = new CharacterSetECI([16], 'ISO-8859-14');
export const ISO8859_15 = new CharacterSetECI([17], 'ISO-8859-15');
export const ISO8859_16 = new CharacterSetECI([18], 'ISO-8859-16');
export const SJIS = new CharacterSetECI([20], 'Shift_JIS');
export const Cp1250 = new CharacterSetECI([21], 'windows-1250');
export const Cp1251 = new CharacterSetECI([22], 'windows-1251');
export const Cp1252 = new CharacterSetECI([23], 'windows-1252');
export const Cp1256 = new CharacterSetECI([24], 'windows-1256');
export const UnicodeBigUnmarked = new CharacterSetECI([25], 'UTF-16BE', 'UnicodeBig');
export const UTF8 = new CharacterSetECI([26], 'UTF-8');
export const ASCII = new CharacterSetECI([27, 170], 'US-ASCII');
export const Big5 = new CharacterSetECI([28]);
export const GB18030 = new CharacterSetECI([29], 'GB2312', 'EUC_CN', 'GBK');
export const EUC_KR = new CharacterSetECI([30], 'EUC-KR');
