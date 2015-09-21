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

/**
 * <p>This class implements a perspective transform in two dimensions. Given four source and four
 * destination points, it will compute the transformation implied between them. The code is based
 * directly upon section 3.4.2 of George Wolberg's "Digital Image Warping"; see pages 54-56.</p>
 *
 * @author Sean Owen
 */
export default class PerspectiveTransform {

  constructor(
    a11, a21, a31,
    a12, a22, a32,
    a13, a23, a33) {
    
    this.a11 = a11;
    this.a12 = a12;
    this.a13 = a13;
    this.a21 = a21;
    this.a22 = a22;
    this.a23 = a23;
    this.a31 = a31;
    this.a32 = a32;
    this.a33 = a33;
  }

  static quadrilateralToQuadrilateral(
    x0, y0,
    x1, y1,
    x2, y2,
    x3, y3,
    x0p, y0p,
    x1p, y1p,
    x2p, y2p,
    x3p, y3p) {

    const qToS = PerspectiveTransform.quadrilateralToSquare(x0, y0, x1, y1, x2, y2, x3, y3);
    const sToQ = PerspectiveTransform.squareToQuadrilateral(x0p, y0p, x1p, y1p, x2p, y2p, x3p, y3p);
    return sToQ.times(qToS);
  }

  transformPoints(xValues, yValues) {

    if (!yValues) { // array of points
      const points = xValues;
      const max = points.length;
      for (let i = 0; i < max; i += 2) {
        const t = this.transformPoint(points[i], points[i + 1]);
        points[i] = t[0];
        points[i + 1] = t[1];
      }
    }
    else {
      const n = xValues.length;
      for (let i = 0; i < n; i++) {
        const t = this.transformPoint(xValues[i], yValues[i]);
        xValues[i] = t[0];
        yValues[i] = t[1];
      }
    }
  }

  transformPoint(x, y) {
    const denominator = this.a13 * x + this.a23 * y + this.a33;
    return [
      (this.a11 * x + this.a21 * y + this.a31) / denominator,
      (this.a12 * x + this.a22 * y + this.a32) / denominator
    ];
  }

  static squareToQuadrilateral(
    x0, y0,
    x1, y1,
    x2, y2,
    x3, y3) {
      
    const dx3 = x0 - x1 + x2 - x3;
    const dy3 = y0 - y1 + y2 - y3;
    if (dx3 === 0.0 && dy3 === 0.0) {
      // Affine
      return new PerspectiveTransform(x1 - x0, x2 - x1, x0,
        y1 - y0, y2 - y1, y0,
        0.0, 0.0, 1.0);
    }
    else {
      const dx1 = x1 - x2;
      const dx2 = x3 - x2;
      const dy1 = y1 - y2;
      const dy2 = y3 - y2;
      const denominator = dx1 * dy2 - dx2 * dy1;
      const a13 = (dx3 * dy2 - dx2 * dy3) / denominator;
      const a23 = (dx1 * dy3 - dx3 * dy1) / denominator;
      return new PerspectiveTransform(x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0,
        y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0,
        a13, a23, 1.0);
    }
  }

  static quadrilateralToSquare(
    x0, y0,
    x1, y1,
    x2, y2,
    x3, y3) {
    
    // Here, the adjoint serves as the inverse:
    return PerspectiveTransform.squareToQuadrilateral(x0, y0, x1, y1, x2, y2, x3, y3).buildAdjoint();
  }

  buildAdjoint() {
    // Adjoint is the transpose of the cofactor matrix:
    return new PerspectiveTransform(
      this.a22 * this.a33 - this.a23 * this.a32,
      this.a23 * this.a31 - this.a21 * this.a33,
      this.a21 * this.a32 - this.a22 * this.a31,
      this.a13 * this.a32 - this.a12 * this.a33,
      this.a11 * this.a33 - this.a13 * this.a31,
      this.a12 * this.a31 - this.a11 * this.a32,
      this.a12 * this.a23 - this.a13 * this.a22,
      this.a13 * this.a21 - this.a11 * this.a23,
      this.a11 * this.a22 - this.a12 * this.a21);
  }

  times(other) {
    return new PerspectiveTransform(
      this.a11 * other.a11 + this.a21 * other.a12 + this.a31 * other.a13,
      this.a11 * other.a21 + this.a21 * other.a22 + this.a31 * other.a23,
      this.a11 * other.a31 + this.a21 * other.a32 + this.a31 * other.a33,
      this.a12 * other.a11 + this.a22 * other.a12 + this.a32 * other.a13,
      this.a12 * other.a21 + this.a22 * other.a22 + this.a32 * other.a23,
      this.a12 * other.a31 + this.a22 * other.a32 + this.a32 * other.a33,
      this.a13 * other.a11 + this.a23 * other.a12 + this.a33 * other.a13,
      this.a13 * other.a21 + this.a23 * other.a22 + this.a33 * other.a23,
      this.a13 * other.a31 + this.a23 * other.a32 + this.a33 * other.a33);

  }

}
