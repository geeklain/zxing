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
 
import BitMatrixParser from './BitMatrixParser';
import DataBlock from './DataBlock';
import DecodedBitStreamParser from './DecodedBitStreamParser';
import QRCodeDecoderMetaData from './QRCodeDecoderMetaData';

 
 
import ChecksumException from '../../ChecksumException';
import GenericGF from '../../common/reedsolomon/GenericGF';
import ReedSolomonDecoder from '../../common/reedsolomon/ReedSolomonDecoder';

/**
 * <p>The main class which implements QR Code decoding -- as opposed to locating and extracting
 * the QR Code from an image.</p>
 *
 * @author Sean Owen
 */
export default class Decoder {

  constructor() {
    this.rsDecoder = new ReedSolomonDecoder(GenericGF.QR_CODE_FIELD_256);
  }

  /**
   * <p>Decodes a QR Code represented as a {@link BitMatrix}. A 1 or "true" is taken to mean a black module.</p>
   *
   * @param bits booleans representing white/black QR Code modules
   * @param hints decoding hints that should be used to influence decoding
   * @return text and bytes encoded within the QR Code
   * @throws FormatException if the QR Code cannot be decoded
   * @throws ChecksumException if error correction fails
   */
  decode(bits, hints) {

    // Construct a parser and read version, error-correction level
    const parser = new BitMatrixParser(bits);
    let exception = null;
    try {
      return this.doDecode(parser, hints);
    }
    catch (e) {
      exception = e;
    }

    try {

      // Revert the bit matrix
      parser.remask();

      // Will be attempting a mirrored reading of the version and format info.
      parser.setMirror(true);

      // Preemptively read the version.
      parser.readVersion();

      // Preemptively read the format information.
      parser.readFormatInformation();

      /*
       * Since we're here, this means we have successfully detected some kind
       * of version and format information when mirrored. This is a good sign,
       * that the QR code may be mirrored, and we should try once more with a
       * mirrored content.
       */
      // Prepare for a mirrored reading.
      parser.mirror();

      const result = this.doDecode(parser, hints);

      // Success! Notify the caller that the code was mirrored.
      result.setOther(new QRCodeDecoderMetaData(true));

      return result;

    }
    catch (e) {
      // Throw the exception from the original reading
      if (exception) {
        throw exception;
      }
      throw e;
    }
  }

  doDecode(parser, hints) {
    const version = parser.readVersion();
    const ecLevel = parser.readFormatInformation().getErrorCorrectionLevel();

    // Read codewords
    const codewords = parser.readCodewords();
    // Separate into data blocks
    const dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel);

    // Count total number of data bytes
    let totalBytes = 0;
    dataBlocks.forEach(function (dataBlock) {
      totalBytes += dataBlock.getNumDataCodewords();
    });
    const resultBytes = new Uint8ClampedArray(totalBytes);
    let resultOffset = 0;

    // Error-correct and copy data blocks together into a stream of bytes
    dataBlocks.forEach(function (dataBlock) {
      const codewordBytes = dataBlock.getCodewords();
      const numDataCodewords = dataBlock.getNumDataCodewords();
      this.correctErrors(codewordBytes, numDataCodewords);
      for (let i = 0; i < numDataCodewords; i++) {
        resultBytes[resultOffset++] = codewordBytes[i];
      }
    }, this);

    // Decode the contents of that stream of bytes
    return DecodedBitStreamParser.decode(resultBytes, version, ecLevel, hints);
  }

  /**
   * <p>Given data and error-correction codewords received, possibly corrupted by errors, attempts to
   * correct the errors in-place using Reed-Solomon error correction.</p>
   *
   * @param codewordBytes data and error correction codewords
   * @param numDataCodewords number of codewords that are data bytes
   * @throws ChecksumException if error correction fails
   */
  correctErrors(codewordBytes, numDataCodewords) {
    const numCodewords = codewordBytes.length;
    // First read into an array of ints
    const codewordsInts = new Int32Array(numCodewords);
    for (let i = 0; i < numCodewords; i++) {
      codewordsInts[i] = codewordBytes[i] & 0xFF;
    }
    let numECCodewords = codewordBytes.length - numDataCodewords;
    try {
      this.rsDecoder.decode(codewordsInts, numECCodewords);
    }
    catch (ignored) {
      throw ChecksumException.getChecksumInstance();
    }
    // Copy back into array of bytes -- only need to worry about the bytes that were data
    // We don't care about errors in the error-correction codewords
    for (let i = 0; i < numDataCodewords; i++) {
      codewordBytes[i] = codewordsInts[i];
    }
  }

}
