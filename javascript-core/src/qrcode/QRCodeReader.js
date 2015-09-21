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

import Decoder from './decoder/Decoder';
import QRCodeDecoderMetaData from './decoder/QRCodeDecoderMetaData';
import Detector from './detector/Detector';

import BarcodeFormat from '../BarcodeFormat';
import DecodeHintType from '../DecodeHintType';
import Result from '../Result';
import ResultMetadataType from '../ResultMetadataType';
import NotFoundException from '../NotFoundException';

import BitMatrix from '../common/BitMatrix';


const NO_POINTS = [];

/**
 * This implementation can detect and decode QR Codes in an image.
 *
 * @author Sean Owen
 */
export default class QRCodeReader {

  constructor() {
    this.decoder = new Decoder();
  }

  getDecoder() {
    return this.decoder;
  }

  /**
   * Locates and decodes a QR code in an image.
   *
   * @return a String representing the content encoded by the QR code
   * @throws NotFoundException if a QR code cannot be found
   * @throws FormatException if a QR code cannot be decoded
   * @throws ChecksumException if error correction fails
   */
  decode(image, hints) {
    let decoderResult;
    let points;
    if (hints && hints[DecodeHintType.PURE_BARCODE]) {
      const bits = QRCodeReader.extractPureBits(image.getBlackMatrix());
      decoderResult = this.decoder.decode(bits, hints);
      points = NO_POINTS;
    }
    else {
      const detectorResult = new Detector(image.getBlackMatrix()).detect(hints);
      decoderResult = this.decoder.decode(detectorResult.getBits(), hints);
      points = detectorResult.getPoints();
    }

    // If the code was mirrored: swap the bottom-left and the top-right points.
    if (decoderResult.getOther() instanceof QRCodeDecoderMetaData) {
      decoderResult.getOther().applyMirroredCorrection(points);
    }

    const result = new Result(decoderResult.getText(), decoderResult.getRawBytes(), points, BarcodeFormat.QR_CODE);
    const byteSegments = decoderResult.getByteSegments();
    if (byteSegments) {
      result.putMetadata(ResultMetadataType.BYTE_SEGMENTS, byteSegments);
    }
    const ecLevel = decoderResult.getECLevel();
    if (ecLevel) {
      result.putMetadata(ResultMetadataType.ERROR_CORRECTION_LEVEL, ecLevel);
    }
    if (decoderResult.hasStructuredAppend()) {
      result.putMetadata(ResultMetadataType.STRUCTURED_APPEND_SEQUENCE,
        decoderResult.getStructuredAppendSequenceNumber());
      result.putMetadata(ResultMetadataType.STRUCTURED_APPEND_PARITY,
        decoderResult.getStructuredAppendParity());
    }
    return result;
  }

  reset() {
    // do nothing
  }

  /**
   * This method detects a code in a "pure" image -- that is, pure monochrome image
   * which contains only an unrotated, unskewed, image of a code, with some white border
   * around it. This is a specialized method that works exceptionally fast in this special
   * case.
   *
   * @see com.google.zxing.datamatrix.DataMatrixReader#extractPureBits(BitMatrix)
   */
  static extractPureBits(image) {

    const leftTopBlack = image.getTopLeftOnBit();
    const rightBottomBlack = image.getBottomRightOnBit();
    if (!leftTopBlack || !rightBottomBlack) {
      throw NotFoundException.getNotFoundInstance();
    }

    const moduleSize = QRCodeReader.moduleSize(leftTopBlack, image);

    let top = leftTopBlack[1];
    let bottom = rightBottomBlack[1];
    let left = leftTopBlack[0];
    let right = rightBottomBlack[0];

    // Sanity check!
    if (left >= right || top >= bottom) {
      throw NotFoundException.getNotFoundInstance();
    }

    if (bottom - top !== right - left) {
      // Special case, where bottom-right module wasn't black so we found something else in the last row
      // Assume it's a square, so use height as the width
      right = left + (bottom - top);
    }

    const matrixWidth = Math.round((right - left + 1) / moduleSize);
    const matrixHeight = Math.round((bottom - top + 1) / moduleSize);
    if (matrixWidth <= 0 || matrixHeight <= 0) {
      throw NotFoundException.getNotFoundInstance();
    }
    if (matrixHeight !== matrixWidth) {
      // Only possibly decode square regions
      throw NotFoundException.getNotFoundInstance();
    }

    // Push in the "border" by half the module width so that we start
    // sampling in the middle of the module. Just in case the image is a
    // little off, this will help recover.
    const nudge = Math.floor(moduleSize / 2.0);
    top += nudge;
    left += nudge;

    // But careful that this does not sample off the edge
    // "right" is the farthest-right valid pixel location -- right+1 is not necessarily
    // This is positive by how much the inner x loop below would be too large
    const nudgedTooFarRight = left + Math.floor((matrixWidth - 1) * moduleSize) - right;
    if (nudgedTooFarRight > 0) {
      if (nudgedTooFarRight > nudge) {
        // Neither way fits; abort
        throw NotFoundException.getNotFoundInstance();
      }
      left -= nudgedTooFarRight;
    }
    // See logic above
    const nudgedTooFarDown = top + Math.floor((matrixHeight - 1) * moduleSize) - bottom;
    if (nudgedTooFarDown > 0) {
      if (nudgedTooFarDown > nudge) {
        // Neither way fits; abort
        throw NotFoundException.getNotFoundInstance();
      }
      top -= nudgedTooFarDown;
    }

    // Now just read off the bits
    const bits = new BitMatrix(matrixWidth, matrixHeight);
    for (let y = 0; y < matrixHeight; y++) {
      const iOffset = top + Math.floor(y * moduleSize);
      for (let x = 0; x < matrixWidth; x++) {
        if (image.get(left + Math.floor(x * moduleSize), iOffset)) {
          bits.set(x, y);
        }
      }
    }
    return bits;
  }

  static moduleSize(leftTopBlack, image) {
    const height = image.getHeight();
    const width = image.getWidth();
    let x = leftTopBlack[0];
    let y = leftTopBlack[1];
    let inBlack = true;
    let transitions = 0;
    while (x < width && y < height) {
      if (inBlack !== image.get(x, y)) {
        if (++transitions === 5) {
          break;
        }
        inBlack = !inBlack;
      }
      x++;
      y++;
    }
    if (x === width || y === height) {
      throw NotFoundException.getNotFoundInstance();
    }
    return (x - leftTopBlack[0]) / 7.0;
  }

}
