/*
 * Copyright (C) 2010 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Records EAN prefix to GS1 Member Organization, where the member organization
 * correlates strongly with a country. This is an imperfect means of identifying
 * a country of origin by EAN-13 barcode value. See
 * <a href='http://en.wikipedia.org/wiki/List_of_GS1_country_codes'>
 * http://en.wikipedia.org/wiki/List_of_GS1_country_codes</a>.
 *
 * @author Sean Owen
 */
export default class EANManufacturerOrgSupport {

  constructor() {
    this.ranges = [];
    this.countryIdentifiers = [];
  }

  lookupCountryIdentifier(productCode) {
    this.initIfNeeded();
    const prefix = Number.parseInt(productCode.substring(0, 3));
    const max = this.ranges.length;
    for (let i = 0; i < max; i++) {
      const range = this.ranges[i];
      const start = range[0];
      if (prefix < start) {
        return null;
      }
      const end = range.length === 1 ? start : range[1];
      if (prefix <= end) {
        return this.countryIdentifiers[i];
      }
    }
    return null;
  }
  
  add(range, id) {
    this.ranges.push(range);
    this.countryIdentifiers.push(id);
  }
  
  initIfNeeded() {
    if (this.ranges.length > 0) {
      return;
    }
    this.add([0,19],    'US/CA');
    this.add([30,39],   'US');
    this.add([60,139],  'US/CA');
    this.add([300,379], 'FR');
    this.add([380],     'BG');
    this.add([383],     'SI');
    this.add([385],     'HR');
    this.add([387],     'BA');
    this.add([400,440], 'DE');
    this.add([450,459], 'JP');
    this.add([460,469], 'RU');
    this.add([471],     'TW');
    this.add([474],     'EE');
    this.add([475],     'LV');
    this.add([476],     'AZ');
    this.add([477],     'LT');
    this.add([478],     'UZ');
    this.add([479],     'LK');
    this.add([480],     'PH');
    this.add([481],     'BY');
    this.add([482],     'UA');
    this.add([484],     'MD');
    this.add([485],     'AM');
    this.add([486],     'GE');
    this.add([487],     'KZ');
    this.add([489],     'HK');
    this.add([490,499], 'JP');    
    this.add([500,509], 'GB');    
    this.add([520],     'GR');
    this.add([528],     'LB');
    this.add([529],     'CY');
    this.add([531],     'MK');
    this.add([535],     'MT');
    this.add([539],     'IE');
    this.add([540,549], 'BE/LU');    
    this.add([560],     'PT');
    this.add([569],     'IS');
    this.add([570,579], 'DK');
    this.add([590],     'PL');
    this.add([594],     'RO');
    this.add([599],     'HU');
    this.add([600,601], 'ZA');
    this.add([603],     'GH');    
    this.add([608],     'BH');
    this.add([609],     'MU');
    this.add([611],     'MA');
    this.add([613],     'DZ');
    this.add([616],     'KE');
    this.add([618],     'CI');    
    this.add([619],     'TN');
    this.add([621],     'SY');
    this.add([622],     'EG');
    this.add([624],     'LY');
    this.add([625],     'JO');
    this.add([626],     'IR');
    this.add([627],     'KW');
    this.add([628],     'SA');
    this.add([629],     'AE');
    this.add([640,649], 'FI');
    this.add([690,695], 'CN');
    this.add([700,709], 'NO');
    this.add([729],     'IL');
    this.add([730,739], 'SE');
    this.add([740],     'GT');
    this.add([741],     'SV');
    this.add([742],     'HN');
    this.add([743],     'NI');
    this.add([744],     'CR');
    this.add([745],     'PA');
    this.add([746],     'DO');
    this.add([750],     'MX');
    this.add([754,755], 'CA');
    this.add([759],     'VE');
    this.add([760,769], 'CH');
    this.add([770],     'CO');
    this.add([773],     'UY');
    this.add([775],     'PE');
    this.add([777],     'BO');
    this.add([779],     'AR');
    this.add([780],     'CL');
    this.add([784],     'PY');
    this.add([785],     'PE');  
    this.add([786],     'EC');
    this.add([789,790], 'BR');
    this.add([800,839], 'IT');
    this.add([840,849], 'ES');
    this.add([850],     'CU');
    this.add([858],     'SK');
    this.add([859],     'CZ');
    this.add([860],     'YU');
    this.add([865],     'MN');    
    this.add([867],     'KP');
    this.add([868,869], 'TR');
    this.add([870,879], 'NL');
    this.add([880],     'KR');
    this.add([885],     'TH');
    this.add([888],     'SG');
    this.add([890],     'IN');
    this.add([893],     'VN');
    this.add([896],     'PK');    
    this.add([899],     'ID');
    this.add([900,919], 'AT');
    this.add([930,939], 'AU');
    this.add([940,949], 'AZ');
    this.add([955],     'MY');
    this.add([958],     'MO');
  }

}
