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

import GenericGFPoly from './GenericGFPoly';

import IllegalArgumentException from '../../IllegalArgumentException';
import ArithmeticException from '../../ArithmeticException';

/**
 * <p>This class contains utility methods for performing mathematical operations over
 * the Galois Fields. Operations use a given primitive polynomial in calculations.</p>
 *
 * <p>Throughout this package, elements of the GF are represented as an {@code int}
 * for convenience and speed (but at the cost of memory).
 * </p>
 *
 * @author Sean Owen
 * @author David Olivier
 */
export default class GenericGF {

  /**
   * Create a representation of GF(size) using the given primitive polynomial.
   *
   * @param primitive irreducible polynomial whose coefficients are represented by
   *  the bits of an int, where the least-significant bit represents the constant
   *  coefficient
   * @param size the size of the field
   * @param b the factor b in the generator polynomial can be 0- or 1-based
   *  (g(x) = (x+a^b)(x+a^(b+1))...(x+a^(b+2t-1))).
   *  In most cases it should be 1, but for QR code it is 0.
   */
  constructor(primitive, size, b) {
    this.primitive = primitive;
    this.size = size;
    this.generatorBase = b;

    this.expTable = new Int32Array(size);
    this.logTable = new Int32Array(size);

    let x = 1;
    for (let i = 0; i < size; i++) {
      this.expTable[i] = x;
      x *= 2; // we're assuming the generator alpha is 2
      if (x >= size) {
        x ^= primitive;
        x &= size - 1;
      }
    }
    for (let i = 0; i < size - 1; i++) {
      this.logTable[this.expTable[i]] = i;
    }
    // logTable[0] == 0 but this should never be used
    this.zero = new GenericGFPoly(this, [0]);
    this.one = new GenericGFPoly(this, [1]);
  }

  getZero() {
    return this.zero;
  }

  getOne() {
    return this.one;
  }

  /**
   * @return the monomial representing coefficient * x^degree
   */
  buildMonomial(degree, coefficient) {
    if (degree < 0) {
      throw new IllegalArgumentException();
    }
    if (coefficient == 0) {
      return this.zero;
    }
    const coefficients = new Int32Array(degree + 1);
    coefficients[0] = coefficient;
    return new GenericGFPoly(this, coefficients);
  }

  /**
   * Implements both addition and subtraction -- they are the same in GF(size).
   *
   * @return sum/difference of a and b
   */
  static addOrSubtract(a, b) {
    return a ^ b;
  }

  /**
   * @return 2 to the power of a in GF(size)
   */
  exp(a) {
    return this.expTable[a];
  }

  /**
   * @return base 2 log of a in GF(size)
   */
  log(a) {
    if (a === 0) {
      throw new IllegalArgumentException();
    }
    return this.logTable[a];
  }

  /**
   * @return multiplicative inverse of a
   */
  inverse(a) {
    if (a === 0) {
      throw new ArithmeticException();
    }
    return this.expTable[this.size - this.logTable[a] - 1];
  }

  /**
   * @return product of a and b in GF(size)
   */
  multiply(a, b) {
    if (a === 0 || b === 0) {
      return 0;
    }
    return this.expTable[(this.logTable[a] + this.logTable[b]) % (this.size - 1)];
  }

  getSize() {
    return this.size;
  }

  getGeneratorBase() {
    return this.generatorBase;
  }

  toString() {
    return 'GF(0x' + this.primitive.toString(16) + ',' + this.size + ')';
  }
}

GenericGF.AZTEC_DATA_12 = new GenericGF(0x1069, 4096, 1); // x^12 + x^6 + x^5 + x^3 + 1
GenericGF.AZTEC_DATA_10 = new GenericGF(0x409, 1024, 1); // x^10 + x^3 + 1
GenericGF.AZTEC_DATA_6 = new GenericGF(0x43, 64, 1); // x^6 + x + 1
GenericGF.AZTEC_PARAM = new GenericGF(0x13, 16, 1); // x^4 + x + 1
GenericGF.QR_CODE_FIELD_256 = new GenericGF(0x011D, 256, 0); // x^8 + x^4 + x^3 + x^2 + 1
GenericGF.DATA_MATRIX_FIELD_256 = new GenericGF(0x012D, 256, 1); // x^8 + x^5 + x^3 + x^2 + 1
GenericGF.AZTEC_DATA_8 = GenericGF.DATA_MATRIX_FIELD_256;
GenericGF.MAXICODE_FIELD_64 = GenericGF.AZTEC_DATA_6;