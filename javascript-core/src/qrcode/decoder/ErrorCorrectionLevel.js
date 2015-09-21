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


const FOR_BITS = [];

/**
 * <p>See ISO 18004:2006, 6.5.1. This enum encapsulates the four error correction levels
 * defined by the QR code standard.</p>
 *
 * @author Sean Owen
 */
export default class ErrorCorrectionLevel {

  constructor(bits, fakeOrdinal) {
    this.bits = bits;
    this.fakeOrdinal = fakeOrdinal;
  }

  getBits() {
    return this.bits;
  }
  
  ordinal() {
    return this.fakeOrdinal;
  }

  /**
   * @param bits int containing the two bits encoding a QR Code's error correction level
   * @return ErrorCorrectionLevel representing the encoded error correction level
   */
  static forBits(bits) {
    if (bits < 0 || bits >= FOR_BITS.length) {
      throw new IllegalArgumentException();
    }
    return FOR_BITS[bits];
  }
}

/** L = ~7% correction */
ErrorCorrectionLevel.L = new ErrorCorrectionLevel(0x01, 0);
  /** M = ~15% correction */
ErrorCorrectionLevel.M = new ErrorCorrectionLevel(0x00, 1);
  /** Q = ~25% correction */
ErrorCorrectionLevel.Q = new ErrorCorrectionLevel(0x03, 2);
  /** H = ~30% correction */
ErrorCorrectionLevel.H = new ErrorCorrectionLevel(0x02, 3);

FOR_BITS.push(
  ErrorCorrectionLevel.M,
  ErrorCorrectionLevel.L,
  ErrorCorrectionLevel.H,
  ErrorCorrectionLevel.Q);