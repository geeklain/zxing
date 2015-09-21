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

import UPCEANReader from './UPCEANReader';
import EAN13Reader from './EAN13Reader';

import BarcodeFormat from '../BarcodeFormat';
import Result from '../Result';
import FormatException from '../FormatException';


/**
 * <p>Implements decoding of the UPC-A format.</p>
 *
 * @author dswitkin@google.com (Daniel Switkin)
 * @author Sean Owen
 */
export default class UPCAReader extends UPCEANReader {

  constructor() {
    super();
    this.ean13Reader = new EAN13Reader();
  }

  
  decodeRow(rowNumber, row, hints, startGuardRange) {
    return UPCAReader.maybeReturnResult(this.ean13Reader.decodeRow(rowNumber, row, hints, startGuardRange));
  }

  decode(image, hints) {
    return UPCAReader.maybeReturnResult(this.ean13Reader.decode(image, hints));
  }

  getBarcodeFormat() {
    return BarcodeFormat.UPC_A;
  }

  decodeMiddle(row, startRange, resultString) {
    return this.ean13Reader.decodeMiddle(row, startRange, resultString);
  }

  static maybeReturnResult(result)  {
    const text = result.getText();
    if (text.charAt(0) === '0') {
      return new Result(text.substring(1), null, result.getResultPoints(), BarcodeFormat.UPC_A);
    } else {
      throw FormatException.getFormatInstance();
    }
  }

}
