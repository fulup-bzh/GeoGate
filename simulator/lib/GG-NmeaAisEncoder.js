/* 
 * Copyright 2014 Fulup Ar Foll
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
 *
 * Implement NMEA AIS encoder based on GGencoder classes
 *
 * Sample implement: CVS, AIS, JSON, GEOJSON
 *
 */
'use strict';

// if running GeoGate development tree use local file
var GGencode;
if  (process.env.HOSTNAME !== 'fulup-desktop') GGencode = require('ggencoder');
                                          else GGencode = require("../../encoder/ApiExport");

// Encode AIS AIVDM or GPRMC depending on position MMSI
function NmeaAisEncoder (data) {
    var msg;

    // Use NMEA GRPMC or AIVDM depending on Vessel MMSI
    if (data.mmsi === 0) {
        // this ship has no MMSI let's use GPRMC format
        switch (data.type) {
            case 1:
                msg = { // built a Fake NMEA authentication message
                    valid: true,
                    nmea: "FAKID" + data.mmsi +',' + data.shipname
                };
                break;
            case 2:
                msg = new GGencode.NmeaEncode(data);
                break;
            default:
                msg = null;
        }
    } else {
        // we are facing multiple boats use AIS ADVDM
        switch (data.type) {
            case 1:
                if (data.class === 'A') data.aistype = 5; else data.aistype = 24;
                msg = new GGencode.AisEncode(data);
                break;
            case 2:
                if (data.class === 'A') data.aistype = 3; else data.aistype = 18;
                msg = new GGencode.AisEncode(data);
                break;
            default:
                msg = null;
        }
    }
    if (msg.valid) return (msg.nmea);
    else return (null);
}

module.exports = NmeaAisEncoder;