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

import DecodeHintType from '../DecodeHintType';
import ResultMetadataType from '../ResultMetadataType';
import ResultPoint from '../ResultPoint';
import BitArray from '../common/BitArray';
import NotFoundException from '../NotFoundException';

/**
 * Encapsulates functionality and implementation that is common to all families
 * of one-dimensional barcodes.
 *
 * @author dswitkin@google.com (Daniel Switkin)
 * @author Sean Owen
 */
export default class OneDReader {

  // Note that we don't try rotation without the try harder flag, even if rotation was supported.
  decode(image, hints) {
    try {
      return this.doDecode(image, hints);
    } catch (nfe) {
      const tryHarder = hints && hints[DecodeHintType.TRY_HARDER];
      if (tryHarder && image.isRotateSupported()) {
        const rotatedImage = image.rotateCounterClockwise();
        const result = this.doDecode(rotatedImage, hints);
        // Record that we found it rotated 90 degrees CCW / 270 degrees CW
        const metadata = result.getResultMetadata();
        let orientation = 270;
        if (metadata && metadata[ResultMetadataType.ORIENTATION]) {
          // But if we found it reversed in doDecode(), add in that result here:
          orientation = (orientation + metadata[ResultMetadataType.ORIENTATION]) % 360;
        }
        result.putMetadata(ResultMetadataType.ORIENTATION, orientation);
        // Update result points
        const points = result.getResultPoints();
        if (points) {
          const height = rotatedImage.getHeight();
          for (let i = 0; i < points.length; i++) {
            points[i] = new ResultPoint(height - points[i].getY() - 1, points[i].getX());
          }
        }
        return result;
      } else {
        throw nfe;
      }
    }
  }

  reset() {
    // do nothing
  }

  /**
   * We're going to examine rows from the middle outward, searching alternately above and below the
   * middle, and farther out each time. rowStep is the number of rows between each successive
   * attempt above and below the middle. So we'd scan row middle, then middle - rowStep, then
   * middle + rowStep, then middle - (2 * rowStep), etc.
   * rowStep is bigger as the image is taller, but is always at least 1. We've somewhat arbitrarily
   * decided that moving up and down by about 1/16 of the image is pretty good; we try more of the
   * image if "trying harder".
   *
   * @param image The image to decode
   * @param hints Any hints that were requested
   * @return The contents of the decoded barcode
   * @throws NotFoundException Any spontaneous errors which occur
   */
  doDecode(image, hints) {
    const width = image.getWidth();
    const height = image.getHeight();
    let row = new BitArray(width);

    const middle = height >> 1;
    const tryHarder = hints && hints[DecodeHintType.TRY_HARDER];
    const rowStep = Math.max(1, height >> (tryHarder ? 8 : 5));
    let maxLines;
    if (tryHarder) {
      maxLines = height; // Look at the whole image, not just the center
    } else {
      maxLines = 15; // 15 rows spaced 1/32 apart is roughly the middle half of the image
    }

    for (let x = 0; x < maxLines; x++) {

      // Scanning from the middle out. Determine which row we're looking at next:
      const rowStepsAboveOrBelow = Math.floor((x + 1) / 2);
      const isAbove = (x & 0x01) == 0; // i.e. is x even?
      const rowNumber = middle + rowStep * (isAbove ? rowStepsAboveOrBelow : -rowStepsAboveOrBelow);
      if (rowNumber < 0 || rowNumber >= height) {
        // Oops, if we run off the top or bottom, stop
        break;
      }

      // Estimate black point for this row and load it:
      try {
        row = image.getBlackRow(rowNumber, row);
      } catch (ignored) { // FIXME ignore all? or just NotFoundException
        continue;
      }

      // While we have the image data in a BitArray, it's fairly cheap to reverse it in place to
      // handle decoding upside down barcodes.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) { // trying again?
          row.reverse(); // reverse the row and continue
          // This means we will only ever draw result points *once* in the life of this method
          // since we want to avoid drawing the wrong points after flipping the row, and,
          // don't want to clutter with noise from every single row scan -- just the scans
          // that start on the center line.
          if (hints && hints[DecodeHintType.NEED_RESULT_POINT_CALLBACK]) {
            const newHints = Object.assign({}, hints);
            delete newHints[DecodeHintType.NEED_RESULT_POINT_CALLBACK];
            hints = newHints;
          }
        }
        try {
          // Look for a barcode
          const result = this.decodeRow(rowNumber, row, hints);
          // We found our barcode
          if (attempt === 1) {
            // But it was upside down, so note that
            result.putMetadata(ResultMetadataType.ORIENTATION, 180);
            // And remember to flip the result points horizontally.
            const points = result.getResultPoints();
            if (points) {
              points[0] = new ResultPoint(width - points[0].getX() - 1, points[0].getY());
              points[1] = new ResultPoint(width - points[1].getX() - 1, points[1].getY());
            }
          }
          return result;
        } catch (e) {
          // continue -- just couldn't decode this row
        }
      }
    }

    throw NotFoundException.getNotFoundInstance('Code not found');
  }

  /**
   * Records the size of successive runs of white and black pixels in a row, starting at a given point.
   * The values are recorded in the given array, and the number of runs recorded is equal to the size
   * of the array. If the row starts on a white pixel at the given start point, then the first count
   * recorded is the run of white pixels starting from that point; likewise it is the count of a run
   * of black pixels if the row begin on a black pixels at that point.
   *
   * @param row row to count from
   * @param start offset into row to start at
   * @param counters array into which to record counts
   * @throws NotFoundException if counters cannot be filled entirely from row before running out
   *  of pixels
   */
  static recordPattern(row, start, counters) {
    const numCounters = counters.length;
    for (let i = 0; i < numCounters; i++) {
      counters[i] = 0;
    }
    const end = row.getSize();
    if (start >= end) {
      throw NotFoundException.getNotFoundInstance();
    }
    let isWhite = !row.get(start);
    let counterPosition = 0;
    let i = start;
    while (i < end) {
      if (row.get(i) ^ isWhite) { // that is, exactly one is true
        counters[counterPosition]++;
      } else {
        counterPosition++;
        if (counterPosition == numCounters) {
          break;
        } else {
          counters[counterPosition] = 1;
          isWhite = !isWhite;
        }
      }
      i++;
    }
    // If we read fully the last section of pixels and filled up our counters -- or filled
    // the last counter but ran off the side of the image, OK. Otherwise, a problem.
    if (!(counterPosition === numCounters || (counterPosition === numCounters - 1 && i === end))) {
      throw NotFoundException.getNotFoundInstance();
    }
  }

  static recordPatternInReverse(row, start, counters) {
    // This could be more efficient I guess
    let numTransitionsLeft = counters.length;
    let last = row.get(start);
    while (start > 0 && numTransitionsLeft >= 0) {
      if (row.get(--start) !== last) {
        numTransitionsLeft--;
        last = !last;
      }
    }
    if (numTransitionsLeft >= 0) {
      throw NotFoundException.getNotFoundInstance();
    }
    OneDReader.recordPattern(row, start + 1, counters);
  }

  /**
   * Determines how closely a set of observed counts of runs of black/white values matches a given
   * target pattern. This is reported as the ratio of the total variance from the expected pattern
   * proportions across all pattern elements, to the length of the pattern.
   *
   * @param counters observed counters
   * @param pattern expected pattern
   * @param maxIndividualVariance The most any counter can differ before we give up
   * @return Number ratio of total variance between counters and pattern compared to total pattern size
   */
  static patternMatchVariance(counters, pattern, maxIndividualVariance) {
    const numCounters = counters.length;
    let total = 0;
    let patternLength = 0;
    for (let i = 0; i < numCounters; i++) {
      total += counters[i];
      patternLength += pattern[i];
    }
    if (total < patternLength) {
      // If we don't even have one pixel per unit of bar width, assume this is too small
      // to reliably match, so fail:
      return Number.POSITIVE_INFINITY;
    }

    const unitBarWidth = total / patternLength;
    maxIndividualVariance *= unitBarWidth;

    let totalVariance = 0.0;
    for (let x = 0; x < numCounters; x++) {
      const counter = counters[x];
      const scaledPattern = pattern[x] * unitBarWidth;
      const variance = counter > scaledPattern ? counter - scaledPattern : scaledPattern - counter;
      if (variance > maxIndividualVariance) {
        return Number.POSITIVE_INFINITY;
      }
      totalVariance += variance;
    }
    return totalVariance / total;
  }
}
