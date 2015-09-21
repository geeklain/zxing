/*
 * Copyright 2009 ZXing authors
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

import Binarizer from '../Binarizer';
import BitArray from './BitArray';
import BitMatrix from './BitMatrix';
import NotFoundException from '../NotFoundException';

const LUMINANCE_BITS = 5;
const LUMINANCE_SHIFT = 8 - LUMINANCE_BITS;
const LUMINANCE_BUCKETS = 1 << LUMINANCE_BITS;
const EMPTY = [];

/**
 * This Binarizer implementation uses the old ZXing global histogram approach. It is suitable
 * for low-end mobile devices which don't have enough CPU or memory to use a local thresholding
 * algorithm. However, because it picks a global black point, it cannot handle difficult shadows
 * and gradients.
 *
 * Faster mobile devices and all desktop applications should probably use HybridBinarizer instead.
 *
 * @author dswitkin@google.com (Daniel Switkin)
 * @author Sean Owen
 */
export default class GlobalHistogramBinarizer extends Binarizer {

  constructor(source) {
    super(source);
    this.luminances = EMPTY;
    this.buckets = [];
  }

  // Applies simple sharpening to the row data to improve performance of the 1D Readers.
  getBlackRow(y, row) {
    const source = this.getLuminanceSource();
    const width = source.getWidth();
    if (!row || row.getSize() < width) {
      row = new BitArray(width);
    } else {
      row.clear();
    }

    this.initArrays(width);
    const localLuminances = source.getRow(y, this.luminances);
    const localBuckets = this.buckets;
    for (let x = 0; x < width; x++) {
      const pixel = localLuminances[x] & 0xff;
      localBuckets[pixel >> LUMINANCE_SHIFT]++;
    }
    const blackPoint = GlobalHistogramBinarizer.estimateBlackPoint(localBuckets);

    let left = localLuminances[0] & 0xff;
    let center = localLuminances[1] & 0xff;
    for (let x = 1; x < width - 1; x++) {
      const right = localLuminances[x + 1] & 0xff;
      // A simple -1 4 -1 box filter with a weight of 2.
      const luminance = ((center * 4) - left - right) / 2;
      if (luminance < blackPoint) {
        row.set(x);
      }
      left = center;
      center = right;
    }
    return row;
  }

  // Does not sharpen the data, as this call is intended to only be used by 2D Readers.
  getBlackMatrix() {
    const source = this.getLuminanceSource();
    const width = source.getWidth();
    const height = source.getHeight();
    const matrix = new BitMatrix(width, height);

    // Quickly calculates the histogram by sampling four rows from the image. This proved to be
    // more robust on the blackbox tests than sampling a diagonal as we used to do.
    this.initArrays(width);
    const localBuckets = this.buckets;
    for (let y = 1; y < 5; y++) {
      const row = Math.floor(height * y / 5);
      const localLuminances = source.getRow(row, this.luminances);
      const right = (width * 4) / 5;
      for (let x = Math.floor(width / 5); x < right; x++) {
        const pixel = localLuminances[x] & 0xff;
        localBuckets[pixel >> LUMINANCE_SHIFT]++;
      }
    }
    const blackPoint = GlobalHistogramBinarizer.estimateBlackPoint(localBuckets);

    // We delay reading the entire image luminance until the black point estimation succeeds.
    // Although we end up reading four rows twice, it is consistent with our motto of
    // "fail quickly" which is necessary for continuous scanning.
    const localLuminances = source.getMatrix();
    for (let y = 0; y < height; y++) {
      const offset = y * width;
      for (let x = 0; x< width; x++) {
        const pixel = localLuminances[offset + x] & 0xff;
        if (pixel < blackPoint) {
          matrix.set(x, y);
        }
      }
    }

    return matrix;
  }

  createBinarizer(source) {
    return new GlobalHistogramBinarizer(source);
  }

  initArrays(luminanceSize) {
    if (this.luminances.length < luminanceSize) {
      this.luminances = new Uint8ClampedArray(luminanceSize);
    }
    for (let x = 0; x < LUMINANCE_BUCKETS; x++) {
      this.buckets[x] = 0;
    }
  }

  static estimateBlackPoint(buckets) {
    // Find the tallest peak in the histogram.
    const numBuckets = buckets.length;
    let maxBucketCount = 0;
    let firstPeak = 0;
    let firstPeakSize = 0;
    for (let x = 0; x < numBuckets; x++) {
      if (buckets[x] > firstPeakSize) {
        firstPeak = x;
        firstPeakSize = buckets[x];
      }
      if (buckets[x] > maxBucketCount) {
        maxBucketCount = buckets[x];
      }
    }

    // Find the second-tallest peak which is somewhat far from the tallest peak.
    let secondPeak = 0;
    let secondPeakScore = 0;
    for (let x = 0; x < numBuckets; x++) {
      const distanceToBiggest = x - firstPeak;
      // Encourage more distant second peaks by multiplying by square of distance.
      const score = buckets[x] * distanceToBiggest * distanceToBiggest;
      if (score > secondPeakScore) {
        secondPeak = x;
        secondPeakScore = score;
      }
    }

    // Make sure firstPeak corresponds to the black peak.
    if (firstPeak > secondPeak) {
      const temp = firstPeak;
      firstPeak = secondPeak;
      secondPeak = temp;
    }

    // If there is too little contrast in the image to pick a meaningful black point, throw rather
    // than waste time trying to decode the image, and risk false positives.
    if (secondPeak - firstPeak <= numBuckets / 16) {
      throw NotFoundException.getNotFoundInstance(); // FIXME
    }

    // Find a valley between them that is low and closer to the white peak.
    let bestValley = secondPeak - 1;
    let bestValleyScore = -1;
    for (let x = secondPeak - 1; x > firstPeak; x--) {
      const fromFirst = x - firstPeak;
      const score = fromFirst * fromFirst * (secondPeak - x) * (maxBucketCount - buckets[x]);
      if (score > bestValleyScore) {
        bestValley = x;
        bestValleyScore = score;
      }
    }

    return bestValley << LUMINANCE_SHIFT;
  }

}
