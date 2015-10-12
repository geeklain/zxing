/*
 * Copyright 2011 ZXing authors
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

import {default as CodaBarReader, ALPHABET, CHARACTER_ENCODINGS} from './CodaBarReader';
import OneDimensionalCodeWriter from './OneDimensionalCodeWriter';

import IllegalArgumentException from '../IllegalArgumentException';

const START_END_CHARS = Object.freeze(['A', 'B', 'C', 'D']);
const ALT_START_END_CHARS = Object.freeze(['T', 'N', '*', 'E']);
const CHARS_WHICH_ARE_TEN_LENGTH_EACH_AFTER_DECODED = Object.freeze(['/', ':', '+', '.']);
const DEFAULT_GUARD = START_END_CHARS[0];

/**
 * This class renders CodaBar as {@code boolean[]}.
 *
 * @author dsbnatut@gmail.com (Kazuki Nishiura)
 */
export default class CodaBarWriter extends OneDimensionalCodeWriter {

  doEncode(contents) {

    if (contents.length < 2) {
      // Can't have a start/end guard, so tentatively add default guards
      contents = DEFAULT_GUARD + contents + DEFAULT_GUARD;
    }
    else {
      // Verify input and calculate decoded length.
      const firstChar = contents.charAt(0).toUpperCase();
      const lastChar = contents.charAt(contents.length - 1).toUpperCase();
      const startsNormal = CodaBarReader.arrayContains(START_END_CHARS, firstChar);
      const endsNormal = CodaBarReader.arrayContains(START_END_CHARS, lastChar);
      const startsAlt = CodaBarReader.arrayContains(ALT_START_END_CHARS, firstChar);
      const endsAlt = CodaBarReader.arrayContains(ALT_START_END_CHARS, lastChar);

      if (startsNormal && !endsNormal
        || startsAlt && !endsAlt
        || !startsNormal && endsNormal
        || !startsAlt && endsAlt) {
        throw new IllegalArgumentException(`Invalid start/end guards: ${contents}`);
      }
      if (!startsNormal && !endsNormal
        && !startsAlt && !endsAlt) {
        // doesn't start and end with guard, so add a default
        contents = DEFAULT_GUARD + contents + DEFAULT_GUARD;
      }
    }

    // The start character and the end character are decoded to 10 length each.
    let resultLength = 20;
    for (let i = 1; i < contents.length - 1; i++) {
      if (Number.isInteger(Number.parseInt(contents.charAt(i))) || contents.charAt(i) === '-' || contents.charAt(i) === '$') {
        resultLength += 9;
      }
      else if (CodaBarReader.arrayContains(CHARS_WHICH_ARE_TEN_LENGTH_EACH_AFTER_DECODED, contents.charAt(i))) {
        resultLength += 10;
      }
      else {
        throw new IllegalArgumentException(`Cannot encode : '${contents.charAt(i)}'`);
      }
    }
    // A blank is placed between each character.
    resultLength += contents.length - 1;

    const result = new Array(resultLength);
    let position = 0;
    for (let index = 0; index < contents.length; index++) {
      let c = contents.charAt(index).toUpperCase();
      if (index === 0 || index === contents.length - 1) {
        // The start/end chars are not in the CodaBarReader.ALPHABET.
        switch (c) {
          case 'T':
            c = 'A';
            break;
          case 'N':
            c = 'B';
            break;
          case '*':
            c = 'C';
            break;
          case 'E':
            c = 'D';
            break;
        }
      }
      let code = 0;
      for (let i = 0; i < ALPHABET.length; i++) {
        // Found any, because I checked above.
        if (c === ALPHABET[i]) {
          code = CHARACTER_ENCODINGS[i];
          break;
        }
      }
      let color = true;
      let counter = 0;
      let bit = 0;
      while (bit < 7) { // A character consists of 7 digit.
        result[position] = color;
        position++;
        if (((code >> (6 - bit)) & 1) === 0 || counter === 1) {
          color = !color; // Flip the color.
          bit++;
          counter = 0;
        }
        else {
          counter++;
        }
      }
      if (index < contents.length - 1) {
        result[position] = false;
        position++;
      }
    }
    return result;
  }
}
