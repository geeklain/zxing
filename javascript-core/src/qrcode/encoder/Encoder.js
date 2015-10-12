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

import MaskUtil from './MaskUtil';
import QRCode from './QRCode';
import ByteMatrix from './ByteMatrix';
import MatrixUtil from './MatrixUtil';
import BlockPair from './BlockPair';

import Mode from '../decoder/Mode';
import Version from '../decoder/Version';

import EncodeHintType from '../../EncodeHintType';
import WriterException from '../../WriterException';

import BitArray from '../../common/BitArray';
import CharacterSetECI from '../../common/CharacterSetECI';
import ReedSolomonEncoder from '../../common/reedsolomon/ReedSolomonEncoder';
import GenericGF from '../../common/reedsolomon/GenericGF';

import {TextEncoder} from 'text-encoding';


// The original table is defined in the table 5 of JISX0510:2004 (p.19).
const ALPHANUMERIC_TABLE = [
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 0x00-0x0f
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 0x10-0x1f
  36, -1, -1, -1, 37, 38, -1, -1, -1, -1, 39, 40, -1, 41, 42, 43, // 0x20-0x2f
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 44, -1, -1, -1, -1, -1, // 0x30-0x3f
  -1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, // 0x40-0x4f
  25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, -1, -1, -1, -1, -1 // 0x50-0x5f
];

const DEFAULT_BYTE_MODE_ENCODING = 'ISO-8859-1';

/**
 * @author satorux@google.com (Satoru Takabayashi) - creator
 * @author dswitkin@google.com (Daniel Switkin) - ported from C++
 */
export default class Encoder {

  // The mask penalty calculation is complicated.  See Table 21 of JISX0510:2004 (p.45) for details.
  // Basically it applies four rules and summate all penalties.
  static calculateMaskPenalty(matrix) {
    return MaskUtil.applyMaskPenaltyRule1(matrix) + MaskUtil.applyMaskPenaltyRule2(matrix) + MaskUtil.applyMaskPenaltyRule3(matrix) + MaskUtil.applyMaskPenaltyRule4(matrix);
  }

  /**
   * @param content text to encode
   * @param ecLevel error correction level to use
   * @return {@link QRCode} representing the encoded QR code
   * @throws WriterException if encoding can't succeed, because of for example invalid content
   *   or configuration
   */
  static encode(content, ecLevel, hints) {

    // Determine what character encoding has been specified by the caller, if any
    let encoding = !hints ? null : hints[EncodeHintType.CHARACTER_SET];
    if (!encoding) {
      encoding = DEFAULT_BYTE_MODE_ENCODING;
    }

    // Pick an encoding mode appropriate for the content. Note that this will not attempt to use
    // multiple modes / segments even if that were more efficient. Twould be nice.
    const mode = Encoder.chooseMode(content, encoding);

    // This will store the header information, like mode and
    // length, as well as "header" segments like an ECI segment.
    const headerBits = new BitArray();

    // Append ECI segment if applicable
    if (mode === Mode.BYTE && !DEFAULT_BYTE_MODE_ENCODING === encoding) {
      const eci = CharacterSetECI[encoding];
      if (eci) {
        Encoder.appendECI(eci, headerBits);
      }
    }

    // (With ECI in place,) Write the mode marker
    Encoder.appendModeInfo(mode, headerBits);

    // Collect data within the main segment, separately, to count its size if needed. Don't add it to
    // main payload yet.
    const dataBits = new BitArray();
    Encoder.appendBytes(content, mode, dataBits, encoding);

    // Hard part: need to know version to know how many bits length takes. But need to know how many
    // bits it takes to know version. First we take a guess at version by assuming version will be
    // the minimum, 1:

    const provisionalBitsNeeded = headerBits.getSize() + mode.getCharacterCountBits(Version.getVersionForNumber(1)) + dataBits.getSize();
    const provisionalVersion = Encoder.chooseVersion(provisionalBitsNeeded, ecLevel);

    // Use that guess to calculate the right version. I am still not sure this works in 100% of cases.

    const bitsNeeded = headerBits.getSize() + mode.getCharacterCountBits(provisionalVersion) + dataBits.getSize();
    const version = Encoder.chooseVersion(bitsNeeded, ecLevel);

    const headerAndDataBits = new BitArray();
    headerAndDataBits.appendBitArray(headerBits);
    // Find "length" of main segment and write it
    const numLetters = mode === Mode.BYTE ? dataBits.getSizeInBytes() : content.length();
    Encoder.appendLengthInfo(numLetters, version, mode, headerAndDataBits);
    // Put data together into the overall payload
    headerAndDataBits.appendBitArray(dataBits);

    const ecBlocks = version.getECBlocksForLevel(ecLevel);
    const numDataBytes = version.getTotalCodewords() - ecBlocks.getTotalECCodewords();

    // Terminate the bits properly.
    Encoder.terminateBits(numDataBytes, headerAndDataBits);

    // Interleave data bits with error correction code.
    const finalBits = Encoder.interleaveWithECBytes(headerAndDataBits,
      version.getTotalCodewords(),
      numDataBytes,
      ecBlocks.getNumBlocks());

    const qrCode = new QRCode();

    qrCode.setECLevel(ecLevel);
    qrCode.setMode(mode);
    qrCode.setVersion(version);

    //  Choose the mask pattern and set to "qrCode".
    const dimension = version.getDimensionForVersion();
    const matrix = new ByteMatrix(dimension, dimension);
    const maskPattern = Encoder.chooseMaskPattern(finalBits, ecLevel, version, matrix);
    qrCode.setMaskPattern(maskPattern);

    // Build the matrix and set it to "qrCode".
    MatrixUtil.buildMatrix(finalBits, ecLevel, version, maskPattern, matrix);
    qrCode.setMatrix(matrix);

    return qrCode;
  }

  /**
   * @return the code point of the table used in alphanumeric mode or
   *  -1 if there is no corresponding code in the table.
   */
  static getAlphanumericCode(code) {
    if (code < ALPHANUMERIC_TABLE.length) {
      return ALPHANUMERIC_TABLE[code];
    }
    return -1;
  }

  /**
   * Choose the best mode by examining the content. Note that 'encoding' is used as a hint;
   * if it is Shift_JIS, and the input is only double-byte Kanji, then we return {@link Mode#KANJI}.
   */
  static chooseMode(content, encoding) {
    if ('Shift_JIS' === encoding) {
      // Choose Kanji mode if all input are double-byte characters
      return Encoder.isOnlyDoubleByteKanji(content) ? Mode.KANJI : Mode.BYTE;
    }
    let hasNumeric = false;
    let hasAlphanumeric = false;
    for (let i = 0; i < content.length; ++i) {
      const c = content.charAt(i);
      if (c >= '0' && c <= '9') {
        hasNumeric = true;
      }
      else if (Encoder.getAlphanumericCode(c) !== -1) {
        hasAlphanumeric = true;
      }
      else {
        return Mode.BYTE;
      }
    }
    if (hasAlphanumeric) {
      return Mode.ALPHANUMERIC;
    }
    if (hasNumeric) {
      return Mode.NUMERIC;
    }
    return Mode.BYTE;
  }

  static isOnlyDoubleByteKanji(content) {
    let bytes;
    try {
      bytes = content.getBytes('Shift_JIS');
    }
    catch (ignored) { // FIXME catch only UnspporteEncodingException?
      return false;
    }
    const length = bytes.length;
    if (length % 2 !== 0) {
      return false;
    }
    for (let i = 0; i < length; i += 2) {
      const byte1 = bytes[i] & 0xFF;
      if ((byte1 < 0x81 || byte1 > 0x9F) && (byte1 < 0xE0 || byte1 > 0xEB)) {
        return false;
      }
    }
    return true;
  }

  static chooseMaskPattern(bits, ecLevel, version, matrix) {

    let minPenalty = Number.MAX_VALUE; // Lower penalty is better.
    let bestMaskPattern = -1;
    // We try all mask patterns to choose the best one.
    for (let maskPattern = 0; maskPattern < QRCode.NUM_MASK_PATTERNS; maskPattern++) {
      MatrixUtil.buildMatrix(bits, ecLevel, version, maskPattern, matrix);
      let penalty = Encoder.calculateMaskPenalty(matrix);
      if (penalty < minPenalty) {
        minPenalty = penalty;
        bestMaskPattern = maskPattern;
      }
    }
    return bestMaskPattern;
  }

  static chooseVersion(numInputBits, ecLevel) {
    // In the following comments, we use numbers of Version 7-H.
    for (let versionNum = 1; versionNum <= 40; versionNum++) {
      const version = Version.getVersionForNumber(versionNum);
      // numBytes = 196
      const numBytes = version.getTotalCodewords();
      // getNumECBytes = 130
      const ecBlocks = version.getECBlocksForLevel(ecLevel);
      const numEcBytes = ecBlocks.getTotalECCodewords();
      // getNumDataBytes = 196 - 130 = 66
      const numDataBytes = numBytes - numEcBytes;
      const totalInputBytes = (numInputBits + 7) / 8;
      if (numDataBytes >= totalInputBytes) {
        return version;
      }
    }
    throw new WriterException('Data too big');
  }

  /**
   * Terminate bits as described in 8.4.8 and 8.4.9 of JISX0510:2004 (p.24).
   */
  static terminateBits(numDataBytes, bits) {
    const capacity = numDataBytes * 8;
    if (bits.getSize() > capacity) {
      throw new WriterException('data bits cannot fit in the QR Code' + bits.getSize() + ' > ' + capacity);
    }
    for (let i = 0; i < 4 && bits.getSize() < capacity; ++i) {
      bits.appendBit(false);
    }
    // Append termination bits. See 8.4.8 of JISX0510:2004 (p.24) for details.
    // If the last byte isn't 8-bit aligned, we'll add padding bits.
    const numBitsInLastByte = bits.getSize() & 0x07;
    if (numBitsInLastByte > 0) {
      for (let i = numBitsInLastByte; i < 8; i++) {
        bits.appendBit(false);
      }
    }
    // If we have more space, we'll fill the space with padding patterns defined in 8.4.9 (p.24).
    const numPaddingBytes = numDataBytes - bits.getSizeInBytes();
    for (let i = 0; i < numPaddingBytes; ++i) {
      bits.appendBits((i & 0x01) === 0 ? 0xEC : 0x11, 8);
    }
    if (bits.getSize() !== capacity) {
      throw new WriterException('Bits size does not equal capacity');
    }
  }

  /**
   * Get number of data bytes and number of error correction bytes for block id "blockID". Store
   * the result in "numDataBytesInBlock", and "numECBytesInBlock". See table 12 in 8.5.1 of
   * JISX0510:2004 (p.30)
   */
  static getNumDataBytesAndNumECBytesForBlockID(numTotalBytes, numDataBytes,
    numRSBlocks, blockID, numDataBytesInBlock, numECBytesInBlock) {
    if (blockID >= numRSBlocks) {
      throw new WriterException('Block ID too large');
    }
    // numRsBlocksInGroup2 = 196 % 5 = 1
    const numRsBlocksInGroup2 = numTotalBytes % numRSBlocks;
    // numRsBlocksInGroup1 = 5 - 1 = 4
    const numRsBlocksInGroup1 = numRSBlocks - numRsBlocksInGroup2;
    // numTotalBytesInGroup1 = 196 / 5 = 39
    const numTotalBytesInGroup1 = Math.floor(numTotalBytes / numRSBlocks);
    // numTotalBytesInGroup2 = 39 + 1 = 40
    const numTotalBytesInGroup2 = numTotalBytesInGroup1 + 1;
    // numDataBytesInGroup1 = 66 / 5 = 13
    const numDataBytesInGroup1 = Math.floor(numDataBytes / numRSBlocks);
    // numDataBytesInGroup2 = 13 + 1 = 14
    const numDataBytesInGroup2 = numDataBytesInGroup1 + 1;
    // numEcBytesInGroup1 = 39 - 13 = 26
    const numEcBytesInGroup1 = numTotalBytesInGroup1 - numDataBytesInGroup1;
    // numEcBytesInGroup2 = 40 - 14 = 26
    const numEcBytesInGroup2 = numTotalBytesInGroup2 - numDataBytesInGroup2;
    // Sanity checks.
    // 26 = 26
    if (numEcBytesInGroup1 !== numEcBytesInGroup2) {
      throw new WriterException('EC bytes mismatch');
    }
    // 5 = 4 + 1.
    if (numRSBlocks !== numRsBlocksInGroup1 + numRsBlocksInGroup2) {
      throw new WriterException('RS blocks mismatch');
    }
    // 196 = (13 + 26) * 4 + (14 + 26) * 1
    if (numTotalBytes !==
      ((numDataBytesInGroup1 + numEcBytesInGroup1) *
        numRsBlocksInGroup1) +
      ((numDataBytesInGroup2 + numEcBytesInGroup2) *
        numRsBlocksInGroup2)) {
      throw new WriterException('Total bytes mismatch');
    }

    if (blockID < numRsBlocksInGroup1) {
      numDataBytesInBlock[0] = numDataBytesInGroup1;
      numECBytesInBlock[0] = numEcBytesInGroup1;
    }
    else {
      numDataBytesInBlock[0] = numDataBytesInGroup2;
      numECBytesInBlock[0] = numEcBytesInGroup2;
    }
  }

  /**
   * Interleave "bits" with corresponding error correction bytes. On success, store the result in
   * "result". The interleave rule is complicated. See 8.6 of JISX0510:2004 (p.37) for details.
   */
  static interleaveWithECBytes(bits, numTotalBytes, numDataBytes, numRSBlocks) {

    // "bits" must have "getNumDataBytes" bytes of data.
    if (bits.getSizeInBytes() !== numDataBytes) {
      throw new WriterException('Number of bits and data bytes does not match');
    }

    // Step 1.  Divide data bytes into blocks and generate error correction bytes for them. We'll
    // store the divided data bytes blocks and error correction bytes blocks into "blocks".
    let dataBytesOffset = 0;
    let maxNumDataBytes = 0;
    let maxNumEcBytes = 0;

    // Since, we know the number of reedsolmon blocks, we can initialize the vector with the number.
    const blocks = new Array(numRSBlocks);

    for (let i = 0; i < numRSBlocks; ++i) {
      const numDataBytesInBlock = new Int32Array(1);
      const numEcBytesInBlock = new Int32Array(1);
      Encoder.getNumDataBytesAndNumECBytesForBlockID(
        numTotalBytes, numDataBytes, numRSBlocks, i,
        numDataBytesInBlock, numEcBytesInBlock);

      const size = numDataBytesInBlock[0];
      const dataBytes = new Uint8ClampedArray(size);
      bits.toBytes(8 * dataBytesOffset, dataBytes, 0, size);
      const ecBytes = Encoder.generateECBytes(dataBytes, numEcBytesInBlock[0]);
      blocks.push(new BlockPair(dataBytes, ecBytes));

      maxNumDataBytes = Math.max(maxNumDataBytes, size);
      maxNumEcBytes = Math.max(maxNumEcBytes, ecBytes.length);
      dataBytesOffset += numDataBytesInBlock[0];
    }
    if (numDataBytes !== dataBytesOffset) {
      throw new WriterException('Data bytes does not match offset');
    }

    const result = new BitArray();

    // First, place data blocks.
    for (let i = 0; i < maxNumDataBytes; ++i) {
      blocks.forEach(function(block) {
        const dataBytes = block.getDataBytes();
        if (i < dataBytes.length) {
          result.appendBits(dataBytes[i], 8);
        }
      });
    }
    // Then, place error correction blocks.
    for (let i = 0; i < maxNumEcBytes; ++i) {
      blocks.forEach(function(block) {
        const ecBytes = block.getErrorCorrectionBytes();
        if (i < ecBytes.length) {
          result.appendBits(ecBytes[i], 8);
        }
      });
    }
    if (numTotalBytes !== result.getSizeInBytes()) { // Should be same.
      throw new WriterException('Interleaving error: ' + numTotalBytes + ' and ' +
        result.getSizeInBytes() + ' differ.');
    }

    return result;
  }

  static generateECBytes(dataBytes, numEcBytesInBlock) {
    const numDataBytes = dataBytes.length;
    const toEncode = new Int32Array(numDataBytes + numEcBytesInBlock);
    for (let i = 0; i < numDataBytes; i++) {
      toEncode[i] = dataBytes[i] & 0xFF;
    }
    new ReedSolomonEncoder(GenericGF.QR_CODE_FIELD_256).encode(toEncode, numEcBytesInBlock);

    const ecBytes = new Int32Array(numEcBytesInBlock);
    for (let i = 0; i < numEcBytesInBlock; i++) {
      ecBytes[i] = toEncode[numDataBytes + i];
    }
    return ecBytes;
  }

  /**
   * Append mode info. On success, store the result in "bits".
   */
  static appendModeInfo(mode, bits) {
    bits.appendBits(mode.getBits(), 4);
  }

  /**
   * Append length info. On success, store the result in "bits".
   */
  static appendLengthInfo(numLetters, version, mode, bits) {
    const numBits = mode.getCharacterCountBits(version);
    if (numLetters >= (1 << numBits)) {
      throw new WriterException(numLetters + ' is bigger than ' + ((1 << numBits) - 1));
    }
    bits.appendBits(numLetters, numBits);
  }

  /**
   * Append "bytes" in "mode" mode (encoding) into "bits". On success, store the result in "bits".
   */
  static appendBytes(content, mode, bits, encoding) {
    switch (mode) {
      case Mode.NUMERIC:
        Encoder.appendNumericBytes(content, bits);
        break;
      case Mode.ALPHANUMERIC:
        Encoder.appendAlphanumericBytes(content, bits);
        break;
      case Mode.BYTE:
        Encoder.append8BitBytes(content, bits, encoding);
        break;
      case Mode.KANJI:
        Encoder.appendKanjiBytes(content, bits);
        break;
      default:
        throw new WriterException('Invalid mode: ' + mode);
    }
  }

  static appendNumericBytes(content, bits) {
    const length = content.length();
    let i = 0;
    while (i < length) {
      const num1 = content.charCodeAt(i) - 48;
      if (i + 2 < length) {
        // Encode three numeric letters in ten bits.
        const num2 = content.charCodeAt(i + 1) - 48;
        const num3 = content.charCodeAt(i + 2) - 48;
        bits.appendBits(num1 * 100 + num2 * 10 + num3, 10);
        i += 3;
      }
      else if (i + 1 < length) {
        // Encode two numeric letters in seven bits.
        const num2 = content.charCodeAt(i + 1) - 48;
        bits.appendBits(num1 * 10 + num2, 7);
        i += 2;
      }
      else {
        // Encode one numeric letter in four bits.
        bits.appendBits(num1, 4);
        i++;
      }
    }
  }

  static appendAlphanumericBytes(content, bits) {
    const length = content.length();
    let i = 0;
    while (i < length) {
      const code1 = Encoder.getAlphanumericCode(content.charCodeAt(i));
      if (code1 === -1) {
        throw new WriterException();
      }
      if (i + 1 < length) {
        const code2 = Encoder.
        getAlphanumericCode(content.charCodeAt(i + 1));
        if (code2 === -1) {
          throw new WriterException();
        }
        // Encode two alphanumeric letters in 11 bits.
        bits.appendBits(code1 * 45 + code2, 11);
        i += 2;
      }
      else {
        // Encode one alphanumeric letter in six bits.
        bits.appendBits(code1, 6);
        i++;
      }
    }
  }

  static append8BitBytes(content, bits, encoding) {
    let bytes;
    try {
      bytes = new TextEncoder(encoding, { NONSTANDARD_allowLegacyEncoding: true }).encode(content);
    }
    catch (uee) {
      throw new WriterException(uee);
    }
    for (let i = 0; i < bytes.length; i++) {
      bits.appendBits(bytes[i], 8);
    }
  }

  static appendKanjiBytes(content, bits) {
    let bytes;
    try {
      bytes = new TextEncoder('Shift_JIS', { NONSTANDARD_allowLegacyEncoding: true }).encode(content);
    }
    catch (uee) {
      throw new WriterException(uee);
    }
    const length = bytes.length;
    for (let i = 0; i < length; i += 2) {
      const byte1 = bytes[i] & 0xFF;
      const byte2 = bytes[i + 1] & 0xFF;
      const code = (byte1 << 8) | byte2;
      let subtracted = -1;
      if (code >= 0x8140 && code <= 0x9ffc) {
        subtracted = code - 0x8140;
      }
      else if (code >= 0xe040 && code <= 0xebbf) {
        subtracted = code - 0xc140;
      }
      if (subtracted === -1) {
        throw new WriterException('Invalid byte sequence');
      }
      const encoded = ((subtracted >> 8) * 0xc0) + (subtracted & 0xff);
      bits.appendBits(encoded, 13);
    }
  }

  static appendECI(eci, bits) {
    bits.appendBits(Mode.ECI.getBits(), 4);
    // This is correct for values up to 127, which is all we need now.
    bits.appendBits(eci.getValue(), 8);
  }
}