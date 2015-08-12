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
 * <p>Encapsulates the result of decoding a barcode within an image.</p>
 *
 * @author Sean Owen
 */
export default class Result {

  constructor(text,
              rawBytes,
              resultPoints,
              format,
              timestamp = Date.now()) {

    this.text = text;
    this.rawBytes = rawBytes;
    this.resultPoints = resultPoints;
    this.format = format;
    this.resultMetadata = null;
    this.timestamp = timestamp;
  }

  /**
   * @return raw text encoded by the barcode
   */
  getText() {
    return this.text;
  }

  /**
   * @return raw bytes encoded by the barcode, if applicable, otherwise {@code null}
   */
  getRawBytes() {
    return this.rawBytes;
  }

  /**
   * @return points related to the barcode in the image. These are typically points
   *         identifying finder patterns or the corners of the barcode. The exact meaning is
   *         specific to the type of barcode that was decoded.
   */
  getResultPoints() {
    return this.resultPoints;
  }

  /**
   * @return {@link BarcodeFormat} representing the format of the barcode that was decoded
   */
  getBarcodeFormat() {
    return this.format;
  }

  /**
   * @return {@link Map} mapping {@link ResultMetadataType} keys to values. May be
   *   {@code null}. This contains optional metadata about what was detected about the barcode,
   *   like orientation.
   */
  getResultMetadata() {
    return this.resultMetadata;
  }

  putMetadata(type, value) {
    if (!this.resultMetadata) {
      this.resultMetadata = {};
    }
    this.resultMetadata[type] = value;
  }

  putAllMetadata(metadata) {
    if (metadata != null) {
      if (!this.resultMetadata) {
        this.resultMetadata = metadata;
      } else {
        Object.assign(this.resultMetadata, metadata);
      }
    }
  }

  addResultPoints(newPoints) {
    const oldPoints = this.resultPoints;
    if (!oldPoints) {
      this.resultPoints = newPoints;
    } else if (newPoints && newPoints.length > 0) {
      this.resultPoints = oldPoints.concat(newPoints);
    }
  }

  getTimestamp() {
    return this.timestamp;
  }

  toString() {
    return this.text;
  }

}
