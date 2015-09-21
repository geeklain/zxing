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

import IllegalArgumentException from '../IllegalArgumentException';

/**
 * <p>A simple, fast array of bits, represented compactly by an array of ints internally.</p>
 *
 * @author Sean Owen
 */
export default class BitArray {

  constructor(size = 0, bits = new Uint32Array(Math.floor((size + 31) / 32))) {
    this.size = size;
    this.bits = bits;
  }

  getSize() {
    return this.size;
  }

  getSizeInBytes() {
    return Math.floor((this.size + 7) / 8);
  }

  /**
   * @param i bit to get
   * @return Boolean true iff bit i is set
   */
  get(i) {
    return (this.bits[Math.floor(i / 32)] & (1 << (i & 0x1F))) !== 0;
  }

  /**
   * Sets bit i.
   *
   * @param i bit to set
   */
  set(i) {
    this.bits[Math.floor(i / 32)] |= 1 << (i & 0x1F);
  }

  /**
   * Flips bit i.
   *
   * @param i bit to set
   */
  flip(i) {
    this.bits[Math.floor(i / 32)] ^= 1 << (i & 0x1F);
  }

  /**
   * @param from first bit to check
   * @return index of first bit that is set, starting from the given index, or size if none are set
   *  at or beyond this given index
   * @see #getNextUnset(int)
   */
  getNextSet(from) {
    if (from >= this.size) {
      return this.size;
    }
    let bitsOffset = Math.floor(from / 32);
    let currentBits = this.bits[bitsOffset];
    // mask off lesser bits first
    currentBits &= ~((1 << (from & 0x1F)) - 1);
    while (currentBits == 0) {
      if (++bitsOffset == this.bits.length) {
        return this.size;
      }
      currentBits = this.bits[bitsOffset];
    }
    const result = (bitsOffset * 32) + BitArray.numberOfTrailingZeros(currentBits);
    return result > this.size ? this.size : result;
  }

  /**
   * @param from index to start looking for unset bit
   * @return index of next unset bit, or {@code size} if none are unset until the end
   * @see #getNextSet(int)
   */
  getNextUnset(from) {
    if (from >= this.size) {
      return this.size;
    }
    let bitsOffset = Math.floor(from / 32);
    let currentBits = ~this.bits[bitsOffset];
    // mask off lesser bits first
    currentBits &= ~((1 << (from & 0x1F)) - 1);
    while (currentBits == 0) {
      if (++bitsOffset == this.bits.length) {
        return this.size;
      }
      currentBits = ~this.bits[bitsOffset];
    }
    const result = (bitsOffset * 32) + BitArray.numberOfTrailingZeros(currentBits);
    return result > this.size ? this.size : result;
  }

  /**
   * Sets a block of 32 bits, starting at bit i.
   *
   * @param i first bit to set
   * @param newBits the new value of the next 32 bits. Note again that the least-significant bit
   * corresponds to bit i, the next-least-significant to i+1, and so on.
   */
  setBulk(i, newBits) {
    this.bits[Math.floor(i / 32)] = newBits;
  }

  /**
   * Sets a range of bits.
   *
   * @param start start of range, inclusive.
   * @param end end of range, exclusive
   */
  setRange(start, end) {
    if (end < start) {
      throw new IllegalArgumentException(); //FIXME
    }
    if (end === start) {
      return;
    }
    end--; // will be easier to treat this as the last actually set bit -- inclusive
    const firstInt = Math.floor(start / 32);
    const lastInt = Math.floor(end / 32);
    for (let i = firstInt; i <= lastInt; i++) {
      const firstBit = i > firstInt ? 0 : start & 0x1F;
      const lastBit = i < lastInt ? 31 : end & 0x1F;
      let mask;
      if (firstBit === 0 && lastBit === 31) {
        mask = -1;
      } else {
        mask = 0;
        for (let j = firstBit; j <= lastBit; j++) {
          mask |= 1 << j;
        }
      }
      this.bits[i] |= mask;
    }
  }

  /**
   * Clears all bits (sets to false).
   */
  clear() {
    this.bits.fill(0);
  }

  /**
   * Efficient method to check if a range of bits is set, or not set.
   *
   * @param start start of range, inclusive.
   * @param end end of range, exclusive
   * @param value if true, checks that bits in range are set, otherwise checks that they are not set
   * @return Boolean true iff all bits are set or not set in range, according to value argument
   * @throws IllegalArgumentException if end is less than or equal to start
   */
  isRange(start, end, value) {
    if (end < start) {
      throw new IllegalArgumentException(); // FIXME
    }
    if (end === start) {
      return true; // empty range matches
    }
    end--; // will be easier to treat this as the last actually set bit -- inclusive
    const firstInt = Math.floor(start / 32);
    const lastInt = Math.floor(end / 32);
    for (let i = firstInt; i <= lastInt; i++) {
      const firstBit = i > firstInt ? 0 : start & 0x1F;
      const lastBit = i < lastInt ? 31 : end & 0x1F;
      let mask;
      if (firstBit == 0 && lastBit == 31) {
        mask = -1;
      } else {
        mask = 0;
        for (let j = firstBit; j <= lastBit; j++) {
          mask |= 1 << j;
        }
      }

      // Return false if we're looking for 1s and the masked bits[i] isn't all 1s (that is,
      // equals the mask, or we're looking for 0s and the masked portion is not all 0s
      if ((this.bits[i] & mask) != (value ? mask : 0)) {
        return false;
      }
    }
    return true;
  }

  appendBit(bit) {
    if (bit) {
      this.bits[Math.floor(this.size / 32)] |= 1 << (this.size & 0x1F);
    }
    this.size++;
  }

  /**
   * Appends the least-significant bits, from value, in order from most-significant to
   * least-significant. For example, appending 6 bits from 0x000001E will append the bits
   * 0, 1, 1, 1, 1, 0 in that order.
   *
   * @param value {@code int} containing bits to append
   * @param numBits bits from value to append
   */
  appendBits(value, numBits) {
    if (numBits < 0 || numBits > 32) {
      throw new IllegalArgumentException('Num bits must be between 0 and 32');
    }
    for (let numBitsLeft = numBits; numBitsLeft > 0; numBitsLeft--) {
      this.appendBit(((value >> (numBitsLeft - 1)) & 0x01) == 1);
    }
  }

  appendBitArray(other) {
    const otherSize = other.size;
    for (let i = 0; i < otherSize; i++) {
      this.appendBit(other.get(i));
    }
  }

  xor(other) {
    if (this.bits.length !== other.bits.length) {
      throw new IllegalArgumentException('Sizes don\'t match');
    }
    for (let i = 0; i < this.bits.length; i++) {
      // The last byte could be incomplete (i.e. not have 8 bits in
      // it) but there is no problem since 0 XOR 0 == 0.
      this.bits[i] ^= other.bits[i];
    }
  }

  /**
   *
   * @param bitOffset first bit to start writing
   * @param array array to write into. Bytes are written most-significant byte first. This is the opposite
   *  of the internal representation, which is exposed by {@link #getBitArray()}
   * @param offset position in array to start writing
   * @param numBytes how many bytes to write
   */
  toBytes(bitOffset, array, offset, numBytes) {
    for (let i = 0; i < numBytes; i++) {
      let theByte = 0;
      for (let j = 0; j < 8; j++) {
        if (this.get(bitOffset)) {
          theByte |= 1 << (7 - j);
        }
        bitOffset++;
      }
      array[offset + i] = theByte;
    }
  }

  /**
   * @return underlying array of ints. The first element holds the first 32 bits, and the least
   *         significant bit is bit 0.
   */
  getBitArray() {
    return this.bits;
  }

  /**
   * Reverses all bits in the array.
   */
  reverse() {
    const newBits = [];
    // reverse all int's first
    const len = Math.floor((this.size - 1) / 32);
    const oldBitsLen = len + 1;
    for (let i = 0; i < oldBitsLen; i++) {
      let x = this.bits[i];
      x = (x & 0x55555555) << 1 | (x >>> 1) & 0x55555555;
      x = (x & 0x33333333) << 2 | (x >>> 2) & 0x33333333;
      x = (x & 0x0f0f0f0f) << 4 | (x >>> 4) & 0x0f0f0f0f;
      x = (x << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24);
      newBits[len - i] = x;
    }
    // now correct the int's if the bit size isn't a multiple of 32
    if (this.size !== oldBitsLen * 32) {
      const leftOffset = oldBitsLen * 32 - this.size;
      let mask = 1;
      for (let i = 0; i < 31 - leftOffset; i++) {
        mask = (mask << 1) | 1;
      }
      let currentInt = (newBits[0] >> leftOffset) & mask;
      for (let i = 1; i < oldBitsLen; i++) {
        const nextInt = newBits[i];
        currentInt |= nextInt << (32 - leftOffset);
        newBits[i - 1] = currentInt;
        currentInt = (nextInt >> leftOffset) & mask;
      }
      newBits[oldBitsLen - 1] = currentInt;
    }
    this.bits = newBits;
  }

  equals(o) {
    if (!(o instanceof BitArray)) {
      return false;
    }
    return this.size === o.size && this.bits.every(function (element, index) {
        return element === o[index];
      });
  }

  toString() {
    const result = [];
    for (let i = 0; i < this.size; i++) {
      if ((i & 0x07) == 0) {
        result.push(' ');
      }
      result.push(this.get(i) ? 'X' : '.');
    }
    return result.join('');
  }

  clone() {
    return new BitArray(this.bits.slice(0), this.size);
  }

  static numberOfTrailingZeros(i) {
    let y;
    if (i === 0) {
      return 32;
    }
    let n = 31;
    y = i << 16;
    if (y !== 0) {
      n = n - 16;
      i = y;
    }
    y = i << 8;
    if (y !== 0) {
      n = n - 8;
      i = y;
    }
    y = i << 4;
    if (y !== 0) {
      n = n - 4;
      i = y;
    }
    y = i << 2;
    if (y !== 0) {
      n = n - 2;
      i = y;
    }
    return n - ((i << 1) >>> 31);
  }
}