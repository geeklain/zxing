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
 * <p>Represents a polynomial whose coefficients are elements of a GF.
 * Instances of this class are immutable.</p>
 *
 * <p>Much credit is due to William Rucklidge since portions of this code are an indirect
 * port of his C++ Reed-Solomon implementation.</p>
 *
 * @author Sean Owen
 */
export default class GenericGFPoly {

  /**
   * @param field the {@link GenericGF} instance representing the field to use
   * to perform computations
   * @param coefficients coefficients as ints representing elements of GF(size), arranged
   * from most significant (highest-power term) coefficient to least significant
   * @throws IllegalArgumentException if argument is null or empty,
   * or if leading coefficient is 0 and this is not a
   * constant polynomial (that is, it is not the monomial "0")
   */
  constructor(field, coefficients) {
    if (coefficients.length === 0) {
      throw new IllegalArgumentException();
    }
    this.field = field;
    const coefficientsLength = coefficients.length;
    if (coefficientsLength > 1 && coefficients[0] === 0) {
      // Leading term must be non-zero for anything except the constant polynomial "0"
      let firstNonZero = 1;
      while (firstNonZero < coefficientsLength && coefficients[firstNonZero] === 0) {
        firstNonZero++;
      }
      if (firstNonZero === coefficientsLength) {
        this.coefficients = Int32Array.of(0);
      } else {
        this.coefficients = new Int32Array(coefficientsLength - firstNonZero);
        for (let i = 0; i < this.coefficients.length; i++) {
          this.coefficients[i] = coefficients[firstNonZero + i];
        }
      }
    } else {
      this.coefficients = coefficients;
    }
  }

  getCoefficients() {
    return this.coefficients;
  }

  /**
   * @return degree of this polynomial
   */
  getDegree() {
    return this.coefficients.length - 1;
  }

  /**
   * @return true iff this polynomial is the monomial "0"
   */
  isZero() {
    return this.coefficients[0] === 0;
  }

  /**
   * @return coefficient of x^degree term in this polynomial
   */
  getCoefficient(degree) {
    return this.coefficients[this.coefficients.length - 1 - degree];
  }

  /**
   * @return evaluation of this polynomial at a given point
   */
  evaluateAt(a) {
    if (a === 0) {
      // Just return the x^0 coefficient
      return this.getCoefficient(0);
    }
    const size = this.coefficients.length;
    if (a === 1) {
      // Just the sum of the coefficients
      let result = 0;
      this.coefficients.forEach(function(coefficient) {
        result = GenericGFPoly.genericGFAddOrSubtract(result, coefficient);
      });
      return result;
    }
    let result = this.coefficients[0];
    for (let i = 1; i < size; i++) {
      result = GenericGFPoly.genericGFAddOrSubtract(this.field.multiply(a, result), this.coefficients[i]);
    }
    return result;
  }

  addOrSubtract(other) {
    if (this.field !== other.field) {
      throw new IllegalArgumentException('GenericGFPolys do not have same GenericGF field');
    }
    if (this.isZero()) {
      return other;
    }
    if (other.isZero()) {
      return this;
    }

    let smallerCoefficients = this.coefficients;
    let largerCoefficients = other.coefficients;
    if (smallerCoefficients.length > largerCoefficients.length) {
      let temp = smallerCoefficients;
      smallerCoefficients = largerCoefficients;
      largerCoefficients = temp;
    }
    const sumDiff = new Int32Array(largerCoefficients.length);
    const lengthDiff = largerCoefficients.length - smallerCoefficients.length;
    // Copy high-order terms only found in higher-degree polynomial's coefficients
    for (let i = 0; i < lengthDiff; i++) {
      sumDiff[i] = largerCoefficients[i];
    }

    for (let i = lengthDiff; i < largerCoefficients.length; i++) {
      sumDiff[i] = GenericGFPoly.genericGFAddOrSubtract(smallerCoefficients[i - lengthDiff], largerCoefficients[i]);
    }

    return new GenericGFPoly(this.field, sumDiff);
  }

  multiply(other) {
    if (this.field !== other.field) {
      throw new IllegalArgumentException('GenericGFPolys do not have same GenericGF field');
    }
    if (this.isZero() || other.isZero()) {
      return this.field.getZero();
    }
    const aCoefficients = this.coefficients;
    const aLength = aCoefficients.length;
    const bCoefficients = other.coefficients;
    const bLength = bCoefficients.length;
    const product = new Int32Array(aLength + bLength - 1);
    for (let i = 0; i < aLength; i++) {
      const aCoeff = aCoefficients[i];
      for (let j = 0; j < bLength; j++) {
        product[i + j] = GenericGFPoly.genericGFAddOrSubtract(product[i + j],
            this.field.multiply(aCoeff, bCoefficients[j]));
      }
    }
    return new GenericGFPoly(this.field, product);
  }

  multiplyByScalar(scalar) {
    if (scalar === 0) {
      return this.field.getZero();
    }
    if (scalar === 1) {
      return this;
    }
    const size = this.coefficients.length;
    const product = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      product[i] = this.field.multiply(this.coefficients[i], scalar);
    }
    return new GenericGFPoly(this.field, product);
  }

  multiplyByMonomial(degree, coefficient) {
    if (degree < 0) {
      throw new IllegalArgumentException();
    }
    if (coefficient === 0) {
      return this.field.getZero();
    }
    const size = this.coefficients.length;
    const product = new Int32Array(size + degree);
    for (let i = 0; i < size; i++) {
      product[i] = this.field.multiply(this.coefficients[i], coefficient);
    }
    return new GenericGFPoly(this.field, product);
  }

  divide(other) {
    if (this.field !== other.field) {
      throw new IllegalArgumentException('GenericGFPolys do not have same GenericGF field');
    }
    if (other.isZero()) {
      throw new IllegalArgumentException('Divide by 0');
    }

    let quotient = this.field.getZero();
    let remainder = this;

    const denominatorLeadingTerm = other.getCoefficient(other.getDegree());
    const inverseDenominatorLeadingTerm = this.field.inverse(denominatorLeadingTerm);

    while (remainder.getDegree() >= other.getDegree() && !remainder.isZero()) {
      const degreeDifference = remainder.getDegree() - other.getDegree();
      const scale = this.field.multiply(remainder.getCoefficient(remainder.getDegree()), inverseDenominatorLeadingTerm);
      const term = other.multiplyByMonomial(degreeDifference, scale);
      const iterationQuotient = this.field.buildMonomial(degreeDifference, scale);
      quotient = quotient.addOrSubtract(iterationQuotient);
      remainder = remainder.addOrSubtract(term);
    }

    return [quotient, remainder];
  }

  toString() {
    const result = new Array(8 * this.getDegree());
    for (let degree = this.getDegree(); degree >= 0; degree--) {
      let coefficient = this.getCoefficient(degree);
      if (coefficient !== 0) {
        if (coefficient < 0) {
          result.push(' - ');
          coefficient = -coefficient;
        } else {
          if (result.length > 0) {
            result.push(' + ');
          }
        }
        if (degree === 0 || coefficient !== 1) {
          const alphaPower = this.field.log(coefficient);
          if (alphaPower === 0) {
            result.push('1');
          } else if (alphaPower === 1) {
            result.push('a');
          } else {
            result.push('a^');
            result.push(alphaPower);
          }
        }
        if (degree !== 0) {
          if (degree === 1) {
            result.push('x');
          } else {
            result.push('x^');
            result.push(degree);
          }
        }
      }
    }
    return result.join('');
  }
  
  
  /**
   * Implements both addition and subtraction -- they are the same in GF(size).
   *
   * Copied from GenricGF to avoid circular dependencies
   * @return sum/difference of a and b
   */
  static genericGFAddOrSubtract(a, b) {
    return a ^ b;
  }

}
