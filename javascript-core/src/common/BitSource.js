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
 * <p>This provides an easy abstraction to read bits at a time from a sequence of bytes, where the
 * number of bits read is not often a multiple of 8.</p>
 *
 * <p>This class is thread-safe but not reentrant -- unless the caller modifies the bytes array
 * it passed in, in which case all bets are off.</p>
 *
 * @author Sean Owen
 */
export default class BitSource {

  /**
   * @param bytes bytes from which this will read bits. Bits will be read from the first byte first.
   * Bits are read within a byte from most-significant to least-significant bit.
   */
  constructor(bytes) {
    this.bytes = bytes;
    this.byteOffset = 0;
    this.bitOffset = 0;
  }

  /**
   * @return index of next bit in current byte which would be read by the next call to {@link #readBits(int)}.
   */
  getBitOffset() {
    return this.bitOffset;
  }

  /**
   * @return index of next byte in input byte array which would be read by the next call to {@link #readBits(int)}.
   */
  getByteOffset() {
    return this.byteOffset;
  }

  /**
   * @param numBits number of bits to read
   * @return int representing the bits read. The bits will appear as the least-significant
   *         bits of the int
   * @throws IllegalArgumentException if numBits isn't in [1,32] or more than is available
   */
  readBits(numBits) {
    if (numBits < 1 || numBits > 32 || numBits > this.available()) {
      throw new IllegalArgumentException(numBits);
    }

    let result = 0;

    // First, read remainder from current byte
    if (this.bitOffset > 0) {
      const bitsLeft = 8 - this.bitOffset;
      const toRead = numBits < bitsLeft ? numBits : bitsLeft;
      const bitsToNotRead = bitsLeft - toRead;
      const mask = (0xFF >> (8 - toRead)) << bitsToNotRead;
      result = (this.bytes[this.byteOffset] & mask) >> bitsToNotRead;
      numBits -= toRead;
      this.bitOffset += toRead;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
    }

    // Next read whole bytes
    if (numBits > 0) {
      while (numBits >= 8) {
        result = (result << 8) | (this.bytes[this.byteOffset] & 0xFF);
        this.byteOffset++;
        numBits -= 8;
      }

      // Finally read a partial byte
      if (numBits > 0) {
        const bitsToNotRead = 8 - numBits;
        const mask = (0xFF >> bitsToNotRead) << bitsToNotRead;
        result = (result << numBits) | ((this.bytes[this.byteOffset] & mask) >> bitsToNotRead);
        this.bitOffset += numBits;
      }
    }

    return result;
  }

  /**
   * @return number of bits that can be read successfully
   */
  available() {
    return 8 * (this.bytes.length - this.byteOffset) - this.bitOffset;
  }

}
