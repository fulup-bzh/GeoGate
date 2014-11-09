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
        mmsi       : 271041815,
        shipname   : "PROGUY"
    }

    ,msg24b: {// class AB static info
        aistype    : 24,
        part       : 1,
        nmea       : "!AIVDM,1,1,,A,H42O55lt0000000D3nink000?0500,0*70",
        mmsi       : 271041815,
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
        mmsi       : 412321751
    }
    ,msg5: { // class A static info
        aistype    : 5,
        nmea       : "!AIVDM,1,1,,A,55?MbV42;H;s<HtKR20EHE:0@T4@Dn2222222216L961O0000i000000000000000000000,0*2D",
        // ,"!AIVDM,2,2,1,A,88888888880,2*25"], [extentions for destination not implemented]
        mmsi       : 351759000,
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
        etaho      : 16,
        etaday     : 15,
        etamonth   :  5,
        draught    : 12.2
        //destination: "NEW YORK  " Extention message not implemented
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



        var aisDecoded  = new AisDecode (aisTest.nmea);

        if (aisDecoded.valid !== true) {
            console.log ("[%s] invalid AIS payload", test);
        } else {
            switch (aisTest.aistype) {
                case 18:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'cog', "sog"]);
                    break;
                case 24:
                    switch (aisTest.part) {
                        case 1: this.CheckResult(test, aisTest, aisDecoded, ["shipname"]); break;
                        case 2: this.CheckResult(test, aisTest, aisDecoded, ['callsign', 'cargo', 'dimA', 'dimB', "dimC", 'dimD']); break;
                        default: console.log ("hoop test=[%s] message type=[%d] invalid part number [%s]", test, aisTest.type, aisDecoded.part);
                        }
                    break;
                case  5:
                    this.CheckResult (test, aisTest, aisDecoded, ["shipname", 'callsign', 'cargo', 'draught', 'dimA', 'dimB', "dimC", 'dimD']);
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
        var aisOut = new AisEncode (aisIn);

        // Warning: this test only to a string comparison on old result from www.maritec.co.za
        if (aisOut.valid) {
            console.log("\nTEST=%s  --> http://www.maritec.co.za/ais", test);
            console.log(" --in=%s", aisIn.nmea);
            console.log(" --ou=%s", aisOut.nmea);
        } else  {
            console.log ("Ais Input message [%s] invalid", test)
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
