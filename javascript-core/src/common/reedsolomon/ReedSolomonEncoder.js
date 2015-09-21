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

import GenericGFPoly from './GenericGFPoly';

import IllegalArgumentException from '../../IllegalArgumentException';

/**
 * <p>Implements Reed-Solomon enbcoding, as the name implies.</p>
 *
 * @author Sean Owen
 * @author William Rucklidge
 */
export default class ReedSolomonEncoder {

  constructor(field) {
    this.field = field;
    this.cachedGenerators = [
      new GenericGFPoly(field, [1])
    ];
  }

  buildGenerator(degree) {
    if (degree >= this.cachedGenerators.length) {
      let lastGenerator = this.cachedGenerators[this.cachedGenerators.length - 1];
      for (let d = this.cachedGenerators.length; d <= degree; d++) {
        const nextGenerator = lastGenerator.multiply(
          new GenericGFPoly(this.field, [
            1,
            this.field.exp(d - 1 + this.field.getGeneratorBase())
          ])
        );
        this.cachedGenerators.push(nextGenerator);
        lastGenerator = nextGenerator;
      }
    }
    return this.cachedGenerators[degree];
  }

  encode(toEncode, ecBytes) {
    if (ecBytes === 0) {
      throw new IllegalArgumentException('No error correction bytes');
    }
    const dataBytes = toEncode.length - ecBytes;
    if (dataBytes <= 0) {
      throw new IllegalArgumentException('No data bytes provided');
    }
    const generator = this.buildGenerator(ecBytes);
    const infoCoefficients = new Int32Array(dataBytes);
    for (let i = 0; i < dataBytes; i++) {
      infoCoefficients[i] = toEncode[i];
    }
    let info = new GenericGFPoly(this.field, infoCoefficients);
    info = info.multiplyByMonomial(ecBytes, 1);
    const remainder = info.divide(generator)[1];
    const coefficients = remainder.getCoefficients();
    const numZeroCoefficients = ecBytes - coefficients.length;
    for (let i = 0; i < numZeroCoefficients; i++) {
      toEncode[dataBytes + i] = 0;
    }
    for (let i = 0; i < coefficients.length; i++) {
      toEncode[dataBytes + numZeroCoefficients + i] = coefficients[i];
    }
  }
}
