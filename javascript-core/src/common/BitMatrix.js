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

import BitArray from './BitArray';

/**
 * <p>Represents a 2D matrix of bits. In function arguments below, and throughout the common
 * module, x is the column position, and y is the row position. The ordering is always x, y.
 * The origin is at the top-left.</p>
 *
 * <p>Internally the bits are represented in a 1-D array of 32-bit ints. However, each row begins
 * with a new int. This is done intentionally so that we can copy out a row into a BitArray very
 * efficiently.</p>
 *
 * <p>The ordering of bits is row-major. Within each int, the least significant bits are used first,
 * meaning they represent lower x values. This is compatible with BitArray's implementation.</p>
 *
 * @author Sean Owen
 * @author dswitkin@google.com (Daniel Switkin)
 */

export default class BitMatrix {

  constructor(width, height = width, rowSize = (width + 31) / 32, bits = []) {

    if (!width || width < 1) {
      throw new IllegalArgumentException("The width must be greater than 0");
    }

    if (!height || height < 1) {
      throw new IllegalArgumentException("The height must be greater than 0");
    }

    this.width = width;
    this.height = height;
    this.rowSize = rowSize;
    this.bits = bits;
  }

  static parse(stringRepresentation, setString, unsetString) {
    if (stringRepresentation === null) {
      throw new IllegalArgumentException();
    }

    const bits = new boolean[stringRepresentation.length()];
    let bitsPos = 0;
    let rowStartPos = 0;
    let rowLength = -1;
    let nRows = 0;
    let pos = 0;
    while (pos < stringRepresentation.length()) {
      if (stringRepresentation.charAt(pos) === '\n' ||
          stringRepresentation.charAt(pos) === '\r') {
        if (bitsPos > rowStartPos) {
          if (rowLength === -1) {
            rowLength = bitsPos - rowStartPos;
          } else if (bitsPos - rowStartPos !== rowLength) {
            throw new IllegalArgumentException("row lengths do not match");
          }
          rowStartPos = bitsPos;
          nRows++;
        }
        pos++;
      }  else if (stringRepresentation.substring(pos, pos + setString.length()) === setString) {
        pos += setString.length();
        bits[bitsPos] = true;
        bitsPos++;
      } else if (stringRepresentation.substring(pos, pos + unsetString.length()) === unsetString) {
        pos += unsetString.length();
        bits[bitsPos] = false;
        bitsPos++;
      } else {
        throw new IllegalArgumentException(
            "illegal character encountered: " + stringRepresentation.substring(pos));
      }
    }

    // no EOL at end?
    if (bitsPos > rowStartPos) {
      if(rowLength === -1) {
        rowLength = bitsPos - rowStartPos;
      } else if (bitsPos - rowStartPos !== rowLength) {
        throw new IllegalArgumentException("row lengths do not match");
      }
      nRows++;
    }

    const matrix = new BitMatrix(rowLength, nRows);
    for (let i = 0; i < bitsPos; i++) {
      if (bits[i]) {
        matrix.set(i % rowLength, i / rowLength);
      }
    }
    return matrix;
  }

  /**
   * <p>Gets the requested bit, where true means black.</p>
   *
   * @param x The horizontal component (i.e. which column)
   * @param y The vertical component (i.e. which row)
   * @return Boolean value of given bit in matrix
   */
  get(x, y) {
    const offset = y * this.rowSize + (x / 32);
    return ((this.bits[offset] >>> (x & 0x1f)) & 1) !== 0;
  }

  /**
   * <p>Sets the given bit to true.</p>
   *
   * @param x The horizontal component (i.e. which column)
   * @param y The vertical component (i.e. which row)
   */
  set(x, y) {
    const offset = y * this.rowSize + (x / 32);
    this.bits[offset] |= 1 << (x & 0x1f);
  }

  unset(x, y) {
    const offset = y * this.rowSize + (x / 32);
    this.bits[offset] &= ~(1 << (x & 0x1f));
  }

  /**
   * <p>Flips the given bit.</p>
   *
   * @param x The horizontal component (i.e. which column)
   * @param y The vertical component (i.e. which row)
   */
  flip(x, y) {
    const offset = y * this.rowSize + (x / 32);
    this.bits[offset] ^= 1 << (x & 0x1f);
  }

  /**
   * Exclusive-or (XOR): Flip the bit in this {@code BitMatrix} if the corresponding
   * mask bit is set.
   *
   * @param mask XOR mask
   */
  xor(mask) {
    if (this.width != mask.getWidth()
        || this.height != mask.getHeight()
        || this.rowSize != mask.getRowSize()) {
      throw new IllegalArgumentException("input matrix dimensions do not match");
    }
    const rowArray = new BitArray(this.width / 32 + 1);
    for (let y = 0; y < this.height; y++) {
      const offset = y * this.rowSize;
      const row = mask.getRow(y, rowArray).getBitArray();
      for (let x = 0; x < this.rowSize; x++) {
        this.bits[offset + x] ^= row[x];
      }
    }
  }

  /**
   * Clears all bits (sets to false).
   */
  clear() {
    this.bits = [];
  }

  /**
   * <p>Sets a square region of the bit matrix to true.</p>
   *
   * @param left The horizontal position to begin at (inclusive)
   * @param top The vertical position to begin at (inclusive)
   * @param width The width of the region
   * @param height The height of the region
   */
  setRegion(left, top, width, height) {
    if (top < 0 || left < 0) {
      throw new IllegalArgumentException("Left and top must be nonnegative");
    }
    if (height < 1 || width < 1) {
      throw new IllegalArgumentException("Height and width must be at least 1");
    }
    const right = left + width;
    const bottom = top + height;
    if (bottom > this.height || right > this.width) {
      throw new IllegalArgumentException("The region must fit inside the matrix");
    }
    for (let y = top; y < bottom; y++) {
      const offset = y * this.rowSize;
      for (let x = left; x < right; x++) {
        this.bits[offset + (x / 32)] |= 1 << (x & 0x1f);
      }
    }
  }

  /**
   * A fast method to retrieve one row of data from the matrix as a BitArray.
   *
   * @param y The row to retrieve
   * @param row An optional caller-allocated BitArray, will be allocated if null or too small
   * @return The resulting BitArray - this reference should always be used even when passing
   *         your own row
   */
  getRow(y, row) {
    if (!row || row.getSize() < width) {
      row = new BitArray(width);
    } else {
      row.clear();
    }
    const offset = y * this.rowSize;
    for (let x = 0; x < this.rowSize; x++) {
      row.setBulk(x * 32, this.bits[offset + x]);
    }
    return row;
  }

  /**
   * @param y row to set
   * @param row {@link BitArray} to copy from
   */
  setRow(y, row) {
    for (let i = 0; i < this.rowSize; i++) {
      this.bits[y * this.rowSize + i] = row[i];
    }
  }

  /**
   * Modifies this {@code BitMatrix} to represent the same but rotated 180 degrees
   */
  rotate180() {
    const width = this.getWidth();
    const height = this.getHeight();
    let topRow = new BitArray(width);
    let bottomRow = new BitArray(width);
    for (let i = 0; i < (height+1) / 2; i++) {
      topRow = this.getRow(i, topRow);
      bottomRow = this.getRow(height - 1 - i, bottomRow);
      topRow.reverse();
      bottomRow.reverse();
      this.setRow(i, bottomRow);
      this.setRow(height - 1 - i, topRow);
    }
  }

  /**
   * This is useful in detecting the enclosing rectangle of a 'pure' barcode.
   *
   * @return {@code left,top,width,height} enclosing rectangle of all 1 bits, or null if it is all white
   */
  getEnclosingRectangle() {
    let left = this.width;
    let top = this.height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < this.height; y++) {
      for (let x32 = 0; x32 < this.rowSize; x32++) {
        const theBits = this.bits[y * this.rowSize + x32];
        if (theBits != 0) {
          if (y < top) {
            top = y;
          }
          if (y > bottom) {
            bottom = y;
          }
          if (x32 * 32 < left) {
            let bit = 0;
            while ((theBits << (31 - bit)) == 0) {
              bit++;
            }
            if ((x32 * 32 + bit) < left) {
              left = x32 * 32 + bit;
            }
          }
          if (x32 * 32 + 31 > right) {
            let bit = 31;
            while ((theBits >>> bit) == 0) {
              bit--;
            }
            if ((x32 * 32 + bit) > right) {
              right = x32 * 32 + bit;
            }
          }
        }
      }
    }

    const width = right - left;
    const height = bottom - top;

    if (width < 0 || height < 0) {
      return null;
    }

    return [left, top, width, height];
  }

  /**
   * This is useful in detecting a corner of a 'pure' barcode.
   *
   * @return {@code x,y} coordinate of top-left-most 1 bit, or null if it is all white
   */
  getTopLeftOnBit() {
    let bitsOffset = 0;
    while (bitsOffset < this.bits.length && this.bits[bitsOffset] === 0) {
      bitsOffset++;
    }
    if (bitsOffset === this.bits.length) {
      return null;
    }
    const y = bitsOffset / this.rowSize;
    let x = (bitsOffset % this.rowSize) * 32;

    const theBits = this.bits[bitsOffset];
    let bit = 0;
    while ((theBits << (31-bit)) === 0) {
      bit++;
    }
    x += bit;
    return [x, y];
  }

  getBottomRightOnBit() {
    let bitsOffset = this.bits.length - 1;
    while (bitsOffset >= 0 && this.bits[bitsOffset] === 0) {
      bitsOffset--;
    }
    if (bitsOffset < 0) {
      return null;
    }

    const y = bitsOffset / this.rowSize;
    let x = (bitsOffset % this.rowSize) * 32;

    const theBits = this.bits[bitsOffset];
    let bit = 31;
    while ((theBits >>> bit) === 0) {
      bit--;
    }
    x += bit;

    return [x, y];
  }

  /**
   * @return The width of the matrix
   */
  getWidth() {
    return this.width;
  }

  /**
   * @return The height of the matrix
   */
  getHeight() {
    return this.height;
  }

  /**
   * @return The row size of the matrix
   */
  getRowSize() {
    return this.rowSize;
  }

  equals(o) {
    if (!(o instanceof BitMatrix)) {
      return false;
    }
    return this.width === o.width
           && this.height === o.height
           && this.rowSize === o.rowSize
           && Arrays.equals(bits, o.bits); // FIXME
  }

  hashCode() { // FIXME useful?
    let hash = this.width;
    hash = 31 * hash + this.width;
    hash = 31 * hash + this.height;
    hash = 31 * hash + this.rowSize;
    hash = 31 * hash + Arrays.hashCode(bits);
    return hash;
  }


  /**
   * @param setString representation of a set bit
   * @param unsetString representation of an unset bit
   * @param lineSeparator newline character in string representation
   * @return string representation of entire matrix utilizing given strings and line separator
   * @deprecated call {@link #toString(String,String)} only, which uses \n line separator always
   */
  toString(setString = 'X ', unsetString = '  ', lineSeparator = '\n') {

    const result = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        result.push(this.get(x, y) ? setString : unsetString);
      }
      result.push(lineSeparator);
    }
    return result.join('');
  }

  clone() {
    return new BitMatrix(this.width, this.height, this.rowSize, this.bits.slice(0));
  }

}
