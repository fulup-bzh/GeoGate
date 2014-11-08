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
 * This file group all Encoder to present final simulator message send to TCP client
 * you may add here any cther presentation standard you would like your clients to receive.
 *
 * Sample implement: CVS, AIS, JSON, GEOJSON
 *
 */
'use strict';

// if running GeoGate development tree use local file
var GGencode;
if  (process.env.HOSTNAME !== 'fulup-desktop')
     GGencode = require('ggencoder');
else GGencode = require("../../encoder/ApiExport");

// Encode AIS AIVDM or GPRMC depending on position MMSI
function NmeaFormater (position) {
    var msg;

    // Use NMEA GRPMC or AIVDM depending on Vessel MMSI
    if (mssi === 0) {
        // this ship has no MMSI let's use GPRMC format
        switch (pos.type) {
            case 1:
                msg = "FAKID" + position.mmsi +',' + position.shipname;
                break;
            case 2:
                msg = new GGencode.NmeaEncode(position);
                break;
            default:
                msg = null;
        }
    } else {
        // we are facing multiple boats use AIS ADVDM
        switch (pos.type) {
            case 1:
                if (position.class === 'A') position.type = 5; else position.type = 24;
                msg = new GGencode.AisEncode(position);
                break;
            case 2:
                if (position.class === 'A') position.type = 3; else position.type = 18;
                msg = new GGencode.AisEncode(position);
                break;
            default:
                msg = null;
        }
    }
    return (msg);
}

// Encode in JSON basic format
function JsonFormater (position) {
   return (JSON.stringify(position));
}

// This class Encode an internal position into a NMEA AIVDM/GPRMC paquet
function Formatter (opts) {
    // provide some default values 
    this.opts= {
        debug      : opts.debug    || 0   // default no debug
    };

    // BuiltIn Encoders
    this.registry =
      { nmea: NmeaFormater
      , json: JsonFormater
      };

    this.Debug (4, "Builtin Encoders=[%s]", this.ListEncoder());
}

// import Debug Helper
Formatter.prototype.Debug = require('./_Debug');

// retreive callback attached to a given Formatter
Formatter.prototype.GetEncoder = function (proto) {
    this.Debug (3, "Providing Encoder=[%s]", proto);
    return (this.registry [proto]);
};

// register a new external Formatter
Formatter.prototype.AddEncoder = function (proto, routine) {
    this.Debug (3, "Registrating Encoder=[%s]", proto);
    this.registry [proto] = routine;
};

// List available Formatter
Formatter.prototype.ListEncoder = function () {
    var list=[];
    for (var slot in this.registry) {
        list.push (slot);
    }
    return (list);
};

module.exports = Formatter;