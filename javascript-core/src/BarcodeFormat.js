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
 * Enumerates barcode formats known to this package. Please keep alphabetized.
 *
 * @author Sean Owen
 */
export default {

  /** Aztec 2D barcode format. */
  AZTEC: 'AZTEC',

  /** CODABAR 1D format. */
  CODABAR: 'CODABAR ',

  /** Code 39 1D format. */
  CODE_39: 'CODE_39',

  /** Code 93 1D format. */
  CODE_93: 'CODE_93',

  /** Code 128 1D format. */
  CODE_128: 'CODE_128',

  /** Data Matrix 2D barcode format. */
  DATA_MATRIX: 'DATA_MATRIX',

  /** EAN-8 1D format. */
  EAN_8: 'EAN_8',

  /** EAN-13 1D format. */
  EAN_13: 'EAN_13',

  /** ITF (Interleaved Two of Five) 1D format. */
  ITF: 'ITF',

  /** MaxiCode 2D barcode format. */
  MAXICODE: 'MAXICODE',

  /** PDF417 format. */
  PDF_417: 'PDF_417',

  /** QR Code 2D barcode format. */
  QR_CODE: 'QR_CODE',

  /** RSS 14 */
  RSS_14: 'RSS_14',

  /** RSS EXPANDED */
  RSS_EXPANDED: 'RSS_EXPANDED',

  /** UPC-A 1D format. */
  UPC_A: 'UPC_A',

  /** UPC-E 1D format. */
  UPC_E: 'UPC_E',

  /** UPC/EAN extension format. Not a stand-alone format. */
  UPC_EAN_EXTENSION: 'UPC_EAN_EXTENSION'
};