/*
 ** Copyright 2014 Fulup Ar Foll.
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
 */

/*
 * Simple GPRMC/GPGGA NMEA Test for decoder/decoder note than GPRID is a fake NMEA paquet used by GeoGateSimulator
 * Reference: http://fr.wikipedia.org/wiki/NMEA_0183
 * http://www.gpspassion.com/forumsen/topic.asp?TOPIC_ID=17661
 * http://rietman.wordpress.com/2008/09/25/how-to-calculate-the-nmea-checksum/
 * http://rl.se/gprmc oneline GPRMC verification
 */
'use strict';


var NmeaEncode= require ('../ApiExport').NmeaEncode;
var NmeaDecode= require ('../ApiExport').NmeaDecode;
var fs        = require('fs');


function NmeaEncodeDecodeTest (args) {

    if (args !== undefined) this.testSet = args;
    else this.testSet = {
        start: { // Fake Nmea Identification for Simulator
            cmd: 1,
            nmea: '$GPRID,123456,This is my Name*05',
            mmsi: 123456,
            name: "This is my Name"
        },
        Track0: { // GPRMC mapped on Nmea classB position report
            cmd: 2,
            nmea: '$GPRMC,081836,A,3751.65,S,14507.36,E,004.0,360.0,130998,011.3,E*62',
            lon: 145.12266666666667,
            lat: -37.86083333333333,
            cog: 360,
            sog: 2  // warning m/s and knts in nmea
        },
        Track1: { // GPRMC mapped on Nmea classB position report
            cmd: 2,
            nmea: '$GPRMC,225446.00,A,4916.45,N,12311.12,W,000.5,054.7,191194,020.3,E*68',
            lon: -123.18533333333335,
            lat: 49.274166666666666,
            cog: 54.7,
            sog: 0.2
        },
        Track2: { // GPRMC from iphone
            cmd: 2,
            nmea: '$GPRMC,182816.26,A,4916.45,N,10342.0309,E,00.00,000.00,210115,0,0,A67',
            lon: -123.18533333333335,
            lat: 49.274166666666666,
            cog: 54.7,
            sog: 0.2
        }

    }
}

// Require/Autoload of method NmeaEncode/Decode fail when run from NmeaEncode/Decode themself why ???
NmeaEncodeDecodeTest.prototype.SetNmeaDecode = function (Method2Test) {NmeaDecode= Method2Test;};
NmeaEncodeDecodeTest.prototype.SetNmeaEncode = function (Method2Test) {NmeaEncode= Method2Test;};

// compare input with decoded outputs
NmeaEncodeDecodeTest.prototype.CheckResult = function (test, Nmeain, Nmeaout, controls) {
    var slot;
    var count=0;
    console.log ("\nChecking: [%s] --> [%s]", test, Nmeain.nmea);
    for (var element in controls){
        slot = controls[element];
        if (Nmeaout[slot] !== Nmeain[slot]) {
            count ++;
            console.log ("--> FX (%s) in:[%s] != out:[%s]", slot, Nmeain[slot], Nmeaout [slot]);
        } else {
            console.log ("--> OK (%s) in:[%s] == out:[%s]", slot, Nmeain[slot], Nmeaout [slot]);
        }
    }

    if (count > 0)  console.log ("** FX Test [%s] Count=%d **", test, count);
    else console.log ("## OK Test [%s] ##", test);
};



NmeaEncodeDecodeTest.prototype.CheckDecode = function () {

    // make sure we get expected output from reference messages
    for (var test in this.testSet) {
        var Nmea2Test    =  this.testSet [test];
        var NmeaDecoded  = new NmeaDecode (Nmea2Test.nmea);

        if (NmeaDecoded.valid !== true) {
            console.log ("[%s] invalid Nmea payload", test);
        } else {
            switch (Nmea2Test.cmd) {
                case 1:
                    this.CheckResult(test, Nmea2Test, NmeaDecoded, ["mmsi","name"]); break;
                    break;
                case 2:
                    this.CheckResult (test, Nmea2Test, NmeaDecoded, ['lon', 'lat', 'cog', "sog"]);
                    break;
                default:
                    console.log ("hoop test=[%s] message type=[%d] not implemented", test, Nmea2Test.type);
            }
        }
    }
};

NmeaEncodeDecodeTest.prototype.CheckEncode = function () {

    // make sure we get expected output from reference messages
    for (var test in this.testSet) {
        var nmeaIn = this.testSet [test];
        if (nmeaIn.cmd !== 1) { // ignore fake NMEA authentication message
            var nmeaOut = new NmeaEncode(nmeaIn);

            console.log("\nTEST=%s  --> http://rl.se/gprmc", test);
            console.log(" --in=%s", nmeaIn.nmea);
            console.log(" --ou=%s", nmeaOut.nmea);
        }
    }
};



NmeaEncodeDecodeTest.prototype.CheckFile = function (filename) {
    var buffer = fs.readFileSync (filename, "utf-8");
    var line   = "";
    var count=0;
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            case '\n': // new line
                count ++;
                console.log ("line[%d]=%s", count,  line);

                var Nmea= new NmeaDecode (line);
                if (Nmea.valid) {
                    console.log(' --> Lon=%d Lat=%d Speed=%d Course=%d', Nmea.lon, Nmea.lat, Nmea.sog, Nmea.cog);
                } else {
                    console.log (" ### hoop Testing Line: %d not implemented [%s]", count);
                }

                line='';
                break;

            case '\r': break;
            default  : line += buffer [idx];
        }
    }
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    var test= new NmeaEncodeDecodeTest ();
    test.CheckDecode();
    test.CheckFile ('FeedSample/GprmcSample.nmea');
    test.CheckEncode();
}

module.exports = NmeaEncodeDecodeTest; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
