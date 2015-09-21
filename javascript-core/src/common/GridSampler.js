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

import BitMatrix from './BitMatrix';
import PerspectiveTransform from './PerspectiveTransform';

import NotFoundException from '../NotFoundException';

let GRID_SAMPLER;

/**
 * Implementations of this class can, given locations of finder patterns for a QR code in an
 * image, sample the right points in the image to reconstruct the QR code, accounting for
 * perspective distortion. It is abstracted since it is relatively expensive and should be allowed
 * to take advantage of platform-specific optimized implementations, like Sun's Java Advanced
 * Imaging library, but which may not be available in other environments such as J2ME, and vice
 * versa.
 *
 * The implementation used can be controlled by calling {@link #setGridSampler(GridSampler)}
 * with an instance of a class which implements this interface.
 *
 * @author Sean Owen
 */
export default class GridSampler {


  /**
   * Sets the implementation of GridSampler used by the library. One global
   * instance is stored, which may sound problematic. But, the implementation provided
   * ought to be appropriate for the entire platform, and all uses of this library
   * in the whole lifetime of the JVM. For instance, an Android activity can swap in
   * an implementation that takes advantage of native platform libraries.
   * 
   * @param newGridSampler The platform-specific object to install.
   */
  static setGridSampler(newGridSampler) {
    GRID_SAMPLER = newGridSampler;
  }

  /**
   * @return the current implementation of GridSampler
   */
  static getInstance() {
    return GRID_SAMPLER;
  }

  /**
   * <p>Checks a set of points that have been transformed to sample points on an image against
   * the image's dimensions to see if the point are even within the image.</p>
   *
   * <p>This method will actually "nudge" the endpoints back onto the image if they are found to be
   * barely (less than 1 pixel) off the image. This accounts for imperfect detection of finder
   * patterns in an image where the QR Code runs all the way to the image border.</p>
   *
   * <p>For efficiency, the method will check points from either end of the line until one is found
   * to be within the image. Because the set of points are assumed to be linear, this is valid.</p>
   *
   * @param image image into which the points should map
   * @param points actual points in x1,y1,...,xn,yn form
   * @throws NotFoundException if an endpoint is lies outside the image boundaries
   */
  static checkAndNudgePoints(image, points) {
    const width = image.getWidth();
    const height = image.getHeight();
    // Check and nudge points from start until we see some that are OK:
    let nudged = true;
    for (let offset = 0; offset < points.length && nudged; offset += 2) {
      const x = Math.floor(points[offset]);
      const y = Math.floor(points[offset + 1]);
      if (x < -1 || x > width || y < -1 || y > height) {
        throw NotFoundException.getNotFoundInstance();
      }
      nudged = false;
      if (x === -1) {
        points[offset] = 0.0;
        nudged = true;
      }
      else if (x === width) {
        points[offset] = width - 1;
        nudged = true;
      }
      if (y === -1) {
        points[offset + 1] = 0.0;
        nudged = true;
      }
      else if (y === height) {
        points[offset + 1] = height - 1;
        nudged = true;
      }
    }
    // Check and nudge points from end:
    nudged = true;
    for (let offset = points.length - 2; offset >= 0 && nudged; offset -= 2) {
      const x = Math.floor(points[offset]);
      const y = Math.floor(points[offset + 1]);
      if (x < -1 || x > width || y < -1 || y > height) {
        throw NotFoundException.getNotFoundInstance();
      }
      nudged = false;
      if (x === -1) {
        points[offset] = 0.0;
        nudged = true;
      }
      else if (x === width) {
        points[offset] = width - 1;
        nudged = true;
      }
      if (y === -1) {
        points[offset + 1] = 0.0;
        nudged = true;
      }
      else if (y === height) {
        points[offset + 1] = height - 1;
        nudged = true;
      }
    }
  }
}

/**
 * @author Sean Owen
 */
class DefaultGridSampler extends GridSampler {

  sampleGrid(image,
    dimensionX,
    dimensionY,
    p1ToX, p1ToY,
    p2ToX, p2ToY,
    p3ToX, p3ToY,
    p4ToX, p4ToY,
    p1FromX, p1FromY,
    p2FromX, p2FromY,
    p3FromX, p3FromY,
    p4FromX, p4FromY) {

    const transform = PerspectiveTransform.quadrilateralToQuadrilateral(
      p1ToX, p1ToY, p2ToX, p2ToY, p3ToX, p3ToY, p4ToX, p4ToY,
      p1FromX, p1FromY, p2FromX, p2FromY, p3FromX, p3FromY, p4FromX, p4FromY);

    return this.sampleGrid(image, dimensionX, dimensionY, transform);
  }

  sampleGrid(image,
    dimensionX,
    dimensionY,
    transform) {
    if (dimensionX <= 0 || dimensionY <= 0) {
      throw NotFoundException.getNotFoundInstance();
    }
    const bits = new BitMatrix(dimensionX, dimensionY);
    const points = new Float32Array(2 * dimensionX);
    for (let y = 0; y < dimensionY; y++) {
      const max = points.length;
      const iValue = y + 0.5;
      for (let x = 0; x < max; x += 2) {
        points[x] = (x / 2) + 0.5;
        points[x + 1] = iValue;
      }
      transform.transformPoints(points);
      // Quick check to see if points transformed to something inside the image;
      // sufficient to check the endpoints
      DefaultGridSampler.checkAndNudgePoints(image, points);
      try {
        for (let x = 0; x < max; x += 2) {
          if (image.get(Math.floor(points[x]), Math.floor(points[x + 1]))) {
            // Black(-ish) pixel
            bits.set(x / 2, y);
          }
        }
      }
      catch (e) {
        // This feels wrong, but, sometimes if the finder patterns are misidentified, the resulting
        // transform gets "twisted" such that it maps a straight line of points to a set of points
        // whose endpoints are in bounds, but others are not. There is probably some mathematical
        // way to detect this about the transformation that I don't know yet.
        // This results in an ugly runtime exception despite our clever checks above -- can't have
        // that. We could check each point's coordinates but that feels duplicative. We settle for
        // catching and wrapping ArrayIndexOutOfBoundsException.
        throw NotFoundException.getNotFoundInstance();
      }
    }
    return bits;
  }
}

GRID_SAMPLER = new DefaultGridSampler();