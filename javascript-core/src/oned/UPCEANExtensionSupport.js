/*
 * Copyright (C) 2010 ZXing authors
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
import UPCEANExtension2Support from './UPCEANExtension2Support';
import UPCEANExtension5Support from './UPCEANExtension5Support';
 
const EXTENSION_START_PATTERN = [1, 1, 2];

export default class UPCEANExtensionSupport {

  constructor() {
    this.twoSupport = new UPCEANExtension2Support();
    this.fiveSupport = new UPCEANExtension5Support();
  }
  
  decodeRow(rowNumber, row, rowOffset) {
    const extensionStartRange = UPCEANReader.findGuardPattern(row, rowOffset, false, EXTENSION_START_PATTERN);
    try {
      return this.fiveSupport.decodeRow(rowNumber, row, extensionStartRange);
    } catch (ignored) {
      return this.twoSupport.decodeRow(rowNumber, row, extensionStartRange);
    }
  }

}
