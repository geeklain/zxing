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

import EncodeHintType from '../EncodeHintType';
import BitMatrix from '../common/BitMatrix';
import IllegalArgumentException from '../IllegalArgumentException';

/**
 * <p>Encapsulates functionality and implementation that is common to one-dimensional barcodes.</p>
 *
 * @author dsbnatut@gmail.com (Kazuki Nishiura)
 */
export default class OneDimensionalCodeWriter {

  /**
   * Encode the contents following specified format.
   * {@code width} and {@code height} are required size. This method may return bigger size
   * {@code BitMatrix} when specified size is too small. The user can set both {@code width} and
   * {@code height} to zero to get minimum size barcode. If negative value is set to {@code width}
   * or {@code height}, {@code IllegalArgumentException} is thrown.
   */
  encode(contents, format, width, height, hints) {

    if (contents.length === 0) {
      throw new IllegalArgumentException('Found empty contents');
    }

    if (width < 0 || height < 0) {
      throw new IllegalArgumentException('Negative size is not allowed. Input: '
                                             + width + 'x' + height);
    }

    let sidesMargin = this.getDefaultMargin();
    if (hints) {
      const sidesMarginInt = hints[EncodeHintType.MARGIN];
      if (sidesMarginInt) {
        sidesMargin = sidesMarginInt;
      }
    }

    const code = this.doEncode(contents);
    return OneDimensionalCodeWriter.renderResult(code, width, height, sidesMargin);
  }

  /**
   * @return BitMatrix a byte array of horizontal pixels (0 = white, 1 = black)
   */
  static renderResult(code, width, height, sidesMargin) {
    const inputWidth = code.length;
    // Add quiet zone on both sides.
    const fullWidth = inputWidth + sidesMargin;
    const outputWidth = Math.max(width, fullWidth);
    const outputHeight = Math.max(1, height);

    const multiple = Math.floor(outputWidth / fullWidth);
    const leftPadding = Math.floor((outputWidth - (inputWidth * multiple)) / 2);

    const output = new BitMatrix(outputWidth, outputHeight);
    for (let inputX = 0, outputX = leftPadding; inputX < inputWidth; inputX++, outputX += multiple) {
      if (code[inputX]) {
        output.setRegion(outputX, 0, multiple, outputHeight);
      }
    }
    return output;
  }


  /**
   * @param target encode black/white pattern into this array
   * @param pos position to start encoding at in {@code target}
   * @param pattern lengths of black/white runs to encode
   * @param startColor starting color - false for white, true for black
   * @return Number the number of elements added to target.
   */
  static appendPattern(target, pos, pattern, startColor) {
    let color = startColor;
    let numAdded = 0;
    pattern.forEach(function(len) {
      for (let j = 0; j < len; j++) {
        target[pos++] = color;
      }
      numAdded += len;
      color = !color; // flip color after each segment
    });
    return numAdded;
  }

  getDefaultMargin() {
    // CodaBar spec requires a side margin to be more than ten times wider than narrow space.
    // This seems like a decent idea for a default for all formats.
    return 10;
  }
}

