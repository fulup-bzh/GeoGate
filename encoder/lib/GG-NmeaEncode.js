/* 
 * Copyright 2014 Fulup Ar Foll.
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

/*
 * Encode an NMEA GPRMC paquet with input compatible with AisEncode
 * $GPRMC,083559.00,A,4717.11437,N,00833.91522,E,0.004,77.52,091202,,,A*57\n
 * $GPRMC,112311.00,A,4732.33   ,N,  253.49   ,W,12   ,43.44,140923,,,A*00
 * Reference: http://fr.wikipedia.org/wiki/NMEA_0183
 * http://www.gpspassion.com/forumsen/topic.asp?TOPIC_ID=17661
 * http://rietman.wordpress.com/2008/09/25/how-to-calculate-the-nmea-checksum/
 * 
 */
'use strict';


var util= require('util');

// Map AIS class A/B position report on a GPRMC NMEA paquet
function NmeaEncode (msg) {
    this.nmea =[];
    var lato,lono;

    switch (msg.msgtype || 2) {// default value is GPRMC
        case 2:  // Ais class A position report
            if (msg.lat < 0) lato="S"; else lato='N';
            if (msg.lon < 0) lono="W"; else lono="E";

            this.EncodeDate();

            var packet =util.format ("$GPRMC,%s.00,A,%s,%s,%s,%s,%s,%s,%s,,,A"
                , this.time, this.Dec2Min(msg.lat,2),lato, this.Dec2Min(msg.lon,3), lono, msg.sog, msg.cog, this.date);

            var checksum = 0; // http://rietman.wordpress.com/2008/09/25/how-to-calculate-the-nmea-checksum/
            for(var i = 1; i < packet.length; i++) {
                checksum = checksum ^ packet.charCodeAt(i);
            }
            var trailer=util.format ("*%s", checksum.toString(16)).toUpperCase();
            this.nmea= packet + trailer;
            this.valid=true;
            break;

        default:
            // not implemented
            this.valid=false;
            break;
    }

}

// move from decimal notation to NMEA formating
NmeaEncode.prototype.Dec2Min = function(cardinal,degpadded){
    // NMEA 4737.1024,N for 47°37'.1024 (degrees padded to 2 digits)
    // NMEA 07620.7863,W for 76°20'.7863 W (degrees padded to 3 digits)
    if (cardinal<0) cardinal=cardinal*-1;
    var deg    = parseInt (cardinal);
    var mindec = (cardinal-deg)*60;
    var card=('00'+deg).slice(-degpadded) + ('0'+mindec.toFixed(4)).slice(-7);

    return (card);
};

// Build an NMEA compliant date 100106=10-jan-2006 053740=5h37m40s
NmeaEncode.prototype.EncodeDate= function () {
    var date= new Date();
    var stringDate= date.toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/\-/g, '').replace(/\:/g, '');
    var time=stringDate.split (" ");
    // yyyymmdd
    // 12345678
    this.date=time[0].substring(6,8) + time[0].substring(4,6) + time[0].substring(2,4);
    // hhmmss
    this.time=time[1];
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    var NmeaEncodeDecodeTest = require ('../test/NmeaEncodeDecodeTest');
    var test= new NmeaEncodeDecodeTest ();
    test.SetNmeaEncode (NmeaEncode);
    test.CheckEncode();
}

module.exports = NmeaEncode; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

