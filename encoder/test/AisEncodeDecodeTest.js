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
 * References:
 *  Gpsd   : http://catb.org/gpsd/AIVDM.html [best doc]
 *  OpenCPN: https://github.com/OpenCPN/OpenCPN [file: AIS_Bitstring.cpp]
 *  http://fossies.org/linux/misc/gpsd-3.11.tar.gz/gpsd-3.11/test/sample.aivdm
 *  online AIS decoder http://www.maritec.co.za/aisvdmvdodecoding/
 */


/*
 * Basic Test for Encoding/Decoding of AIS packet
 */
'use strict';

var AisEncode= require ('../ApiExport').AisEncode;
var AisDecode= require ('../ApiExport').AisDecode;

var fs       = require('fs');

function AisEncodeDecodeTest (args) {

    if (args !== undefined) this.testSet = args;
    else this.testSet = {
    msg24a: {// class B static info
        aistype    : 24,
        part       : 0,
        nmea       : "!AIVDM,1,1,,A,H42O55i18tMET00000000000000,0*6F",
        cargo      : 60,
        callsign   : "AB1234",
        mmsi       : "271041815",
        shipname   : "PROGUY"
    }

    ,msg24b: {// class AB static info
        aistype    : 24,
        part       : 1,
        nmea       : "!AIVDM,1,1,,A,H42O55lt0000000D3nink000?0500,0*70",
        mmsi       : "271041815",
        cargo      : 60,
        callsign   : "TC6163",
        dimA       : 0,
        dimB       : 15,
        dimC       : 0,
        dimD       : 5
    }
    ,msg18: { // standard class B Position report
        aistype    : 18,
        nmea       : '!AIVDM,1,1,,A,B69>7mh0?B<:>05B0`0e8TN000000,0*72',
        cog        : 72.2,
        sog        : 6.1000000000000005,
        dsc        : false,
        repeat     : false,
        accuracy   : true,
        lon        : 122.47338666666667,
        lat        : 36.91968,
        second     : 50,
        mmsi       : "412321751"
    }
    ,msg5: { // class A static info
        aistype    : 5,
        nmea       : "!AIVDM,1,1,,A,55?MbV42;H;s<HtKR20EHE:0@T4@Dn2222222216L961O0000i000000000000000000000,0*2D",
        // ,"!AIVDM,2,2,1,A,88888888880,2*25"], [extentions for destination not implemented]
        mmsi       : "351759000",
        imo        : 9134270,
        callsign   : "3FOF8  ",
        shipname   : "EVER DIADEM         ",
        cargo      : 70,
        dimA       : 225,
        dimB       : 70,
        dimC       :  1,
        dimD       : 31,
        fixaistype    :  1,
        etamn      :  0,
        etaho      :  0,
        etaday     :  0,
        etamonth   :  0,
        draught    : 19.6
    }
    ,msg5_2: { // class A static info
        aistype    : 5,
        nmea       : ["!AIVDM,2,1,3,B,59NWwC@2>6th7Q`7800858l8Dd00000000000018Cp:A:6a=0G@TQCADR0EQ,0*09",
                      "!AIVDM,2,2,3,B,CP000000000,2*37"],
        mmsi       : "235074703",
        imo        : 12894435639,
        callsign   : "A8ZA2",
        shipname   : "BARMBEK",
        destination: "BREMERHAVEN",
        cargo      : 72,
        dimA       : 159,
        dimB       : 10,
        dimC       : 17,
        dimD       : 10,
        fixaistype :  1,
        etamn      :  0,
        etaho      : 13,
        etaday     : 18,
        etamonth   : 10,
        draught    : 9.3
    }
    ,msg4: { // base station
        aistype    : 4,
        nmea       : "!AIVDM,1,1,,B,4@4k1EQutd87k:Etkmb:JM7P08Na,0*38",
        mmsi       : "005030230",
        lon        : 144.60521666666668,
        lat        : -38.16343333333333
    }
    ,msg21: { // aid of navigation
        aistype    : 21,
        nmea       : "!AIVDM,1,1,,B,ENlt;J@aSqP0000000000000000E;WUdm7Mu800003vP10,4*46",
        mmsi       : "995036009",
        shipname   : "SG3",
        aidtype    : 1,
        lon        : 144.88636666666667,
        lat        : -38.03993166666667
    }
    ,msg1: {
        aistype    : 1,
        nmea       : "!AIVDM,1,1,,A,133REv0P00P=K?TMDH6P0?vN289>,0*46",
        mmsi       : "205035000",
        rot        : -128,
        smi        : 0,
        aidtype    : 1,
        lon        : 2.9328833333333333,
        lat        : 51.23759
    }
    ,msg1_2: {
        aistype    : 1,
        nmea       : "!AIVDM,1,1,,A,13u?etPv2;0n:dDPwUM1U1Cb069D,0*23",
        mmsi       : "265547250",
        rot        : -8,
        smi        : 0,
        aidtype    : 1,
        lon        : 11.832976666666667,
        lat        : 57.66035333333333
    }
}}

// compare input with decoded outputs
AisEncodeDecodeTest.prototype.CheckResult = function (test, aisin, aisout, controls) {
    var slot;
    var count=0;
    console.log ("\nChecking: [%s] --> [%s]", test, aisin.nmea);
    for (var element in controls){
        slot = controls[element];
        if (aisout[slot] !== aisin[slot]) {
            count ++;
            console.log ("--> FX (%s) in:[%s] != out:[%s]", slot, aisin[slot], aisout [slot]);
        } else {
            console.log ("--> OK (%s) in:[%s] == out:[%s]", slot, aisin[slot], aisout [slot]);
        }
    }

    if (count > 0)  console.log ("** FX Test [%s] Count=%d **", test, count);
    else console.log ("## OK Test [%s] ##", test);
};



AisEncodeDecodeTest.prototype.CheckDecode = function () {

    // make sure we get expected output from reference messages
    for (var test in this.testSet) {
        var aisTest     = this.testSet [test];

        // Require a string or an array. Turn string into an array. Return for
        // anything else.
        if(aisTest.nmea instanceof Object) {
            var session={};
            var aisDecoded = new AisDecode(aisTest.nmea[0], session);
            var aisDecoded = new AisDecode(aisTest.nmea[1], session);
        } else {
            var aisDecoded = new AisDecode(aisTest.nmea);
        }

        if (aisDecoded.valid !== true) {
            console.log ("[%s] invalid AIS payload", test);
        } else {
            switch (aisTest.aistype) {
                case 1:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'rot', 'smi']);
                    break;
                case 4:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat']);
                    break;
                case 21:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'shipname', 'aidtype', 'lat', 'lon']);
                    break;
                case 18:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'cog', "sog"]);
                    break;
                case 24:
                    switch (aisTest.part) {
                        case 0: this.CheckResult(test, aisTest, aisDecoded, ["shipname"]); break;
                        case 1: this.CheckResult(test, aisTest, aisDecoded, ['callsign', 'cargo', 'dimA', 'dimB', "dimC", 'dimD']); break;
                        default: console.log ("hoop test=[%s] message type=[%d] invalid part number [%s]", test, aisTest.type, aisDecoded.part);
                        }
                    break;
                case  5:
                    this.CheckResult (test, aisTest, aisDecoded, ["shipname", 'callsign', 'destination', 'cargo', 'draught', 'dimA', 'dimB', "dimC", 'dimD']);
                    break;
                default:
                    console.log ("hoop test=[%s] message type=[%d] not implemented", test, aisTest.type);
            }
        }
    }
};

AisEncodeDecodeTest.prototype.CheckEncode = function () {

    // make sure we get expected output from reference messages
    for (var test in this.testSet) {
        var aisIn  = this.testSet [test];

        if (aisIn.nmea.lenght === 1) {
            var aisOut = new AisEncode (aisIn);

            // Warning: this test only to a string comparison on old result from www.maritec.co.za
            if (aisOut.valid) {
                console.log("\nTEST=%s  --> http://www.maritec.co.za/ais", test);
                console.log(" --in=%s", aisIn.nmea);
                console.log(" --ou=%s", aisOut.nmea);
            } else  {
                console.log ("Ais Input message [%s] invalid", test);
            }

            var error=0;
            for (var i=0; i< aisIn.nmea.length; i++) {
                if (aisIn.nmea [i] !== aisOut.nmea [i]) {
                    error=1;
                    console.log ('  ** idx=%d in:%s != out:%s', i, aisIn.nmea [i],  aisOut.nmea [i]);
                }
            }

            if (error === 0 )console.log ("  ## OK ##");
            else console.log ("  ** ERROR **");
        }
    }
};

// Require/Autoload of method AisEncode/Decode fail when run from AisEncode/Decode themself why ???
AisEncodeDecodeTest.prototype.SetAisDecode = function (Method2Test) {AisDecode= Method2Test;}
AisEncodeDecodeTest.prototype.SetAisEncode = function (Method2Test) {AisEncode= Method2Test;}

AisEncodeDecodeTest.prototype.CheckFile = function (filename) {
    var buffer = fs.readFileSync (filename, "utf-8");
    var line   = "";
    var count=0;
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            case '\n': // new line
                count ++;
                console.log ("line[%d]=%s", count,  line);

                var ais= new AisDecode (line);
                switch (ais.aistype) {
                    case 1:
                    case 2:
                    case 3:
                    case 18:
                        console.log (' -->msg-18 mmsi=%d Lon=%d Lat=%d Speed=%d Course=%d, NavStatus=%s/%s'
                            , ais.mmsi, ais.lon, ais.lat, ais.sog, ais.cog, ais.navstatus, ais.GetNavStatus());
                        break;
                    case 24:
                        console.log (' -->msg-24 mmsi=%d shipname=%s callsign=%s cargo=%s/%s length=%d width=%d'
                            , ais.mmsi,ais.shipname, ais.callsign, ais.cargo, ais.GetVesselType(),  ais.length, ais.width);
                        break;
                    case 5:
                        console.log (' -->msg-05 mmsi=%d shipname=%s callsign=%s cargo=%s/%s draught=%d length=%d width=%d'
                            , ais.mmsi,ais.shipname, ais.callsign, ais.cargo, ais.GetVesselType(),ais.draught, ais.length, ais.width);
                        break;
                    default:
                        console.log (" ### hoop Testing msg-%d ==> [%s] not implemented", ais.aistype, ais.Getaistype());
                }

                line='';
                break;

            case '\r': break;
            default:
                line += buffer [idx];
        }
    }
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    var test= new AisEncodeDecodeTest ();
    test.CheckDecode();
    test.CheckEncode();
    //test.CheckFile ('FeedSample/AisHubSample.nmea');
}

module.exports = AisEncodeDecodeTest; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
