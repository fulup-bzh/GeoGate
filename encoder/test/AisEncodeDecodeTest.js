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
        sog        : 6.1,
        dsc        : false,
        repeat     : false,
        accuracy   : true,
        lon        : 122.47338666666667,
        lat        : 36.91968,
        second     : 50,
        mmsi       : "412321751"
    }
    ,msg19: { // Extended class B Position report
        aistype    : 19,
        nmea       : ['!AIVDM,2,1,9,B,C43NbT0008VGWDVHNs0000N10PHb`NL00000,0*6D',
                      '!AIVDM,2,2,9,B,00000000N0`90RPP,0*59'],
        mmsi       : "272083600",
        cog        : 0,
        sog        : 0,
        lon        : 33.527321666666666,
        lat        : 44.61725333333333,
        second     : 60,
        shipname   : "PLUTON"        
    }
    ,msg5: { // class A static info
        aistype    : 5,
        nmea       : "!AIVDM,1,1,,A,55?MbV42;H;s<HtKR20EHE:0@T4@Dn2222222216L961O0000i000000000000000000000,0*2D",
                      //"!AIVDM,2,2,1,A,88888888880,2*25"], // [extentions for destination not implemented]
        mmsi       : "351759000",
        imo        : 9134270,
        callsign   : "3FOF8",
        shipname   : "EVER DIADEM",
        destination: "",
        cargo      : 70,
        dimA       : 225,
        dimB       : 70,
        dimC       :  1,
        dimD       : 31,
        fixaistype :  1,
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
    ,msg5_3: { // class A static info version 2
        aistype    : 5,
        nmea       : ["!AIVDM,2,1,9,A,53Moi:81Qk8LLpQH000PD98T@D4r118Tp<E=<0153@f594ke07TSm21D,0*63",
                      "!AIVDM,2,2,9,A,hF@000000000000,2*73"],
        mmsi       : "235074703",
        imo        : 6409351,
        callsign   : "GNHV",
        shipname   : "HEBRIDEAN PRINCESS",
        destination: "ROTHESAY",
        cargo      : 69,
        dimA       : 26,
        dimB       : 46,
        dimC       : 5,
        dimD       : 9,
        fixaistype : 1,
        etamn      : 0,
        etaho      : 13,
        etaday     : 7,
        etamonth   : 3,
        draught    : 3
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
        lat        : -38.03993166666667,
        txt        : "",
        virtual    : 1,
        offpos     : 0
    }
    ,msg21a: { // aid of navigation with extra text
        aistype    : 21,
        nmea       : "!AIVDM,1,1,,B,EvjO`>C2qHtq@8:W:0h9PW@1Pb0Paq`g;STu`10888N00313p12H31@hi@,4*0E",
        mmsi       : "992471097",
        shipname   : "E2192 PUNTA SAN CATA",
        aidtype    : 6,
        lon        : 18.306638333333332,
        lat        : 40.390795,
        txt        : "LDO DI LECCE",
        virtual    : 0,
        offpos     : 0
    }
    ,msg9: { // sar aircraft
        aistype    : 9,
        nmea       : "!AIVDM,1,1,,B,900048wwTiJamA6Eu>B7Pd@20<6M,0*66",
        mmsi       : "000001059",
        lon        : -74.747675,
        lat        : 38.37196,
        alt        : 4094,
        sog        : 305,
        cog        : 192.2
    }    
    ,msg1: {
        aistype    : 1,
        nmea       : "!AIVDM,1,1,,A,133REv0P00P=K?TMDH6P0?vN289>,0*46",
        mmsi       : "205035000",
        rot        : -128,
        smi        : 0,
        sog        : 0,
        cog        : 0,
        lon        : 2.9328833333333333,
        lat        : 51.23759
    }
    ,msg1_1: { // sample with rot
        aistype    : 1,
        nmea       : "!AIVDM,1,1,,A,13u?etPv2;0n:dDPwUM1U1Cb069D,0*24",
        mmsi       : "265547250",
        rot        : -8,
        smi        : 0,
        sog        : 13.9,
        cog        : 40.4,
        lon        : 11.832976666666667,
        lat        : 57.66035333333333
    }
    ,msg1_2: { // position for mob
        aistype    : 1,
        nmea       : "!AIVDM,1,1,,B,1>O5`4wP01:F?39b6mD>4?w81P00,0*0D",
        mmsi       : "972122131",
        lon        : 144.66747333333333,
        lat        : -38.2612,
        rot        : -128,
        smi        : 0,
        sog        : 0.1,
        cog        : 360,
        navstatus  : 15
    }
    ,msg1_nopos: { // position not available: ITU-R M.1371 sentinels lon=181 / lat=91
        aistype    : 1,
        nmea       : "!AIVDM,1,1,,A,139>Jh@P00<tSF0l4Q@00?wp0000,0*0D",
        mmsi       : "211000001",
        lon        : undefined,
        lat        : undefined,
        rot        : -128,
        smi        : 0,
        sog        : 0,
        cog        : 0
    }
    ,msg14: { // text msg
        aistype    : 14,
        nmea       : "!AIVDM,1,1,,A,>>O5`4tlt:1@E=@,2*15",
        mmsi       : "972122131",
        txt        : "MOB TEST"
    }
    ,msg8_200_10: { // dac 200 fid 10 msg static inland ship
        aistype    : 8,
        nmea       : "!AIVDM,1,1,,A,85Mv070j2d>=<e<<=PQhhg`59P00,0*26",
        mmsi       : "366968860",
        length     : 27,
        width      : 9.7,
        draught    : 3.04,
        shiptypeERI: 8000
    }
    ,msg8_001_11: { // dac 001 fid 11 meteorological and hydrographic data
        aistype    : 800111,
        nmea       : "!AIVDM,1,1,,A,802R5Ph0BkCwP0E<>jGaPPTHS7wwwwwwwk6wwwwwwwwwwwwwwwwwwtPwwwt,2*72",
        mmsi       : "002655619",
        lon        : 11.573166666666667,
        lat        : 57.88800,
        avgwindspd : 2,
        winddir    : 280,
        airtemp    : undefined,
        watertemp  : 13.1
    }
    ,msg8_001_31: { // dac 001 fid 31 meteorological and hydrographic data
        aistype    : 800131,
        nmea       : "!AIVDM,1,1,1,B,8>h8nkP0Glr=<hFI0D6??wvlFR06EuOwgwl?wnSwe7wvlOw?sAwwnSGmwvh0,0*17",
        mmsi       : "990000846",
        lon        : 171.5985,
        lat        : 12.2283,
        avgwindspd : undefined,
        winddir    : undefined,
        airtemp    : undefined,
        watertemp  : undefined,
        waterlevel : undefined
    }
    ,msg8_001_31_2: { // dac 001 fid 31 meteorological and hydrographic data
        aistype    : 800131,
        nmea       : "!AIVDM,1,1,,A,8@2R5Ph0GhEUJiaWPFkt4RqUdf06EuFPB22p1Pd3S@h>:WwwsAwwnS@vwvwt,0*57",
        mmsi       : "002655619",
        lon        : 11.7881,
        lat        : 57.6811,
        avgwindspd : 36,
        winddir    : 203,
        airtemp    : undefined,
        watertemp  : 6.2,
        waterlevel : 0.47
    }
    ,msg8_001_22: { // dac 001 fid 22 area notice, NOAA right whale sighting
        aistype    : 800122,
        nmea       : "!AIVDM,1,1,0,B,803Ovrh0EPM0WB0h2l0MwJUi=6B4G9000aip8<2Bt2Hq2Qhp,0*01",
        mmsi       : "003669739",
        mmsikey    : "003669739:29",
        linkid     : 29,
        noticetype : 1,
        month      : 3,
        day        : 20,
        hour       : 16,
        minute     : 6,
        duration   : 1440,
        txt        : "NOAA RW SGHTNG",
        subareas   : [{shape: "circle", lon: -70.2243, lat: 42.105866666666664, precision: 4, radius: 14810},
                      {shape: "text", text: "NOAA RW SGHTNG"}]
    }
    ,msg8_001_22_2: { // dac 001 fid 22 area notice, NOAA dynamic management area polygon
        aistype    : 800122,
        nmea       : ["!AIVDM,2,1,1,A,803Ovrh0EPJ0Vvch00@=w52I9BK<00000VFHkP0>D>3,0*24",
                      "!AIVDM,2,2,1,A,;J005>?11PBGP4=1PPP,0*3F"],
        mmsi       : "003669739",
        mmsikey    : "003669739:26",
        linkid     : 26,
        noticetype : 1,
        month      : 3,
        day        : 15,
        hour       : 21,
        minute     : 30,
        duration   : 2,
        txt        : "NOAA RW DMA",
        subareas   : [{shape: "circle", lon: -70.40821666666666, lat: 40.02495, precision: 4, radius: 0},
                      {shape: "polygon", points: [{bearing: 89.5, distance: 103000}, {bearing: 0, distance: 114000}, {bearing: 270, distance: 101000}]},
                      {shape: "text", text: "NOAA RW DMA   "}]
    }
    ,msg8_001_22_3: { // dac 001 fid 22 area notice, concatenated text sub-areas
        aistype    : 800122,
        nmea       : ["!AIVDM,3,1,4,A,81mg=5@0EP:4R40807P>0<D1>MNt00000f>FNVfnw7>6>FNU=?B5PD5HDPD8,0*26",
                      "!AIVDM,3,2,4,A,1Dd2J09jL08JArJH5P=E<D9@<5P<9>0`bMl42Q0d2Pc2T59CPCE@@?C54PD?,0*60",
                      "!AIVDM,3,3,4,A,d0@d0IqhH:Pah:U54PD?75D85Bf00,0*03"],
        mmsi       : "123456789",
        mmsikey    : "123456789:10",
        linkid     : 10,
        noticetype : 9,
        month      : 1,
        day        : 1,
        hour       : 0,
        minute     : 1,
        duration   : 60,
        txt        : "12345678901234MORE TEXT THAT SPANS ACROSS MULTIPLE LINES.  THE TEXT IS SUPPOSED TO BE CONCATENATED TOGETHER.",
        subareas   : [{shape: "circle", lon: -69.8, lat: 42.849983333333334, precision: 4, radius: 0},
                      {shape: "text", text: "12345678901234"}, {shape: "text", text: "MORE TEXT THAT"},
                      {shape: "text", text: " SPANS ACROSS"},  {shape: "text", text: " MULTIPLE LIN"},
                      {shape: "text", text: "ES.  THE TEXT "}, {shape: "text", text: "IS SUPPOSED TO"},
                      {shape: "text", text: " BE CONCATENAT"}, {shape: "text", text: "ED TOGETHER."}]
    }
    ,msg8_367_22: { // dac 367 fid 22 geographic notice, USCG right whale buoy
        aistype    : 836722,
        nmea       : "!AIVDM,1,1,,B,8h3Ovq1KmPA`08b8007P3ct5uAPmtlAkh000,0*2F",
        mmsi       : "003669732",
        mmsikey    : "003669732:104",
        version    : 1,
        action     : undefined,
        linkid     : 104,
        noticetype : 0,
        month      : 4,
        day        : 10,
        hour       : 17,
        minute     : 0,
        duration   : 60,
        txt        : undefined,
        subareas   : [{shape: "circle", lon: -70.11843666666667, lat: 42.31134, precision: 2, radius: 9260}]
    }
    ,msg8_367_22_2: { // dac 367 fid 22 geographic notice, USCG ice polylines
        aistype    : 836722,
        nmea       : ["!ANVDM,2,1,0,B,8h3Ovq1KmP@N<95=`2l01=dN<b7pGeP00000LL8PSV8RQ8cTs5H0LTHh477P,0*36",
                      "!ANVDM,2,2,0,B,Rpus@000,0*46"],
        mmsi       : "003669732",
        mmsikey    : "003669732:30",
        version    : 1,
        action     : undefined,
        linkid     : 30,
        noticetype : 24,
        month      : 4,
        day        : 17,
        hour       : 9,
        minute     : 45,
        duration   : 1440,
        txt        : undefined,
        subareas   : [{shape: "circle", lon: -175.829165, lat: 59.367221666666666, precision: 4, radius: 0},
                      {shape: "polyline", points: [{bearing: 112.5, distance: 13000}, {bearing: 115, distance: 27300}, {bearing: 132.5, distance: 17400}, {bearing: 157.5, distance: 17200}]},
                      {shape: "polyline", points: [{bearing: 145.5, distance: 19200}, {bearing: 131.5, distance: 24000}, {bearing: 139.5, distance: 24700}]}]
    }
    ,msg8_367_22_4: { // dac 367 fid 22 geographic notice, USCG spec sample polyline and text
        aistype    : 836722,
        nmea       : ["!AIVDM,2,1,0,A,85M:Ih1KmPA`tBAs85`01cON31N;U`P00000H;Gl1gfp52tjFq20H3r9P000,0*64",
                      "!AIVDM,2,2,0,A,00000000bPbJT1Q9hd680000,0*03"],
        mmsi       : "366123456",
        mmsikey    : "366123456:104",
        version    : 1,
        action     : undefined,
        linkid     : 104,
        noticetype : 120,
        month      : 9,
        day        : 4,
        hour       : 15,
        minute     : 25,
        duration   : 2880,
        txt        : "TEST LINE 1",
        subareas   : [{shape: "circle", lon: -71.68166666666667, lat: 41.14833333333333, precision: 4, radius: 0},
                      {shape: "polyline", points: [{bearing: 45, distance: 2000}, {bearing: 55.5, distance: 1500}, {bearing: 20, distance: 755}, {bearing: 75, distance: 1825}]},
                      {shape: "polyline", points: [{bearing: 15.5, distance: 550}]},
                      {shape: "text", text: "TEST LINE 1"}]
    }
    ,msg8_367_22_5: { // dac 367 fid 22 geographic notice, USCG test text, start time not available
        aistype    : 836722,
        nmea       : "!AIVDM,1,1,,A,803Ow2iKmPFJwP37P000bbHHsrPbJP000000,0*6E",
        mmsi       : "003669771",
        mmsikey    : "003669771:410",
        version    : 1,
        action     : undefined,
        linkid     : 410,
        noticetype : 127,
        month      : undefined,
        day        : undefined,
        hour       : undefined,
        minute     : undefined,
        duration   : 0,
        txt        : "USCG_TEST",
        subareas   : [{shape: "text", text: "USCG_TEST"}]
    }
    ,msg8_367_22_6: { // dac 367 fid 22 geographic notice, USCG spec sample rectangle
        aistype    : 836722,
        nmea       : "!AIVDM,1,1,0,A,85M:Ih1KmPAVhjAs80e0;cKBN1N:W8Q@:2`0,0*0C",
        mmsi       : "366123456",
        mmsikey    : "366123456:102",
        version    : 1,
        action     : undefined,
        linkid     : 102,
        noticetype : 97,
        month      : 9,
        day        : 4,
        hour       : 15,
        minute     : 25,
        duration   : 360,
        txt        : undefined,
        subareas   : [{shape: "rectangle", lon: -71.91, lat: 41.141666666666666, precision: 4, east: 400, north: 200, orientation: 42}]
    }
    ,msg8_367_22_7: { // dac 367 fid 22 geographic notice, USCG spec sample sector
        aistype    : 836722,
        nmea       : "!AIVDM,1,1,0,A,85M:Ih1KmPAW5BAs80e0EcN<11N6th@6BgL8,0*13",
        mmsi       : "366123456",
        mmsikey    : "366123456:103",
        version    : 1,
        action     : undefined,
        linkid     : 103,
        noticetype : 10,
        month      : 9,
        day        : 4,
        hour       : 15,
        minute     : 25,
        duration   : 360,
        txt        : undefined,
        subareas   : [{shape: "sector", lon: -71.75166666666667, lat: 41.11666666666667, precision: 2, radius: 5000, left: 175, right: 225}]
    }
    ,msg8_367_22_8: { // dac 367 fid 22 geographic notice release 2 with action, synthetic from msg8_367_22
        aistype    : 836722,
        nmea       : "!AIVDM,1,1,,B,8h3Ovq1KmPQ`08b8007T3ct5uAPmtlAkh000,0*3B",
        mmsi       : "003669732",
        mmsikey    : "003669732:104",
        version    : 2,
        action     : 1,
        linkid     : 104,
        noticetype : 0,
        month      : 4,
        day        : 10,
        hour       : 17,
        minute     : 0,
        duration   : 60,
        txt        : undefined,
        subareas   : [{shape: "circle", lon: -70.11843666666667, lat: 42.31134, precision: 2, radius: 9260}]
    }
    ,msg8_367_22_3: { // dac 367 fid 22 geographic notice, USCG right whale polygon
        aistype    : 836722,
        nmea       : "!SAVDO,1,1,1,B,8h3Ovq1KmPHw08aTp?IH1chmi1Md2p@00000T02v8LGle2v;@000,0*2D",
        mmsi       : "003669732",
        mmsikey    : "003669732:575",
        version    : 1,
        action     : undefined,
        linkid     : 575,
        noticetype : 0,
        month      : 4,
        day        : 10,
        hour       : 12,
        minute     : 39,
        duration   : 7883,
        txt        : undefined,
        subareas   : [{shape: "circle", lon: -70.733, lat: 40.933, precision: 2, radius: 0},
                      {shape: "polygon", points: [{bearing: 0, distance: 76000}, {bearing: 270, distance: 76200}, {bearing: 180, distance: 76000}]}]
    }
    ,msg8_367_33_0: { // dac 367 fid 33 meteorological and hydrographic data location
        aistype    : 836733,
        nmea       : "!AIVDM,1,1,,A,8P3QiWAKp@dw8>5LlaB1aQkhCr@P,0*28",
        mmsi       : "003699101",
        siteid     : 3,
        lon        : -122.954,
        lat        : 46.106
    }
    ,msg8_367_33_2: { // dac 367 fid 33 meteorological and hydrographic data wind
        aistype    : 836733,
        nmea       : "!AIVDM,1,1,,B,8>k1oCQKpBdvs:750l;7mre0<N00,0*4C",
        mmsi       : "993032014",
        siteid     : 50,
        avgwindspd : 7,
        winddir    : 13
    }
    ,msg27: { // position lon range
        aistype    : 27,
        nmea       : "!AIVDM,1,1,,B,K9TJi5H@o9jiPP2D,0*3E",
        mmsi       : "642167061",
        lon        : 23.531666666666666,
        lat        : 37.86833333333333,
        sog        : 0,
        cog        : 37,
        navstatus  : 1
    }
   
}}

// compare input with decoded outputs
AisEncodeDecodeTest.prototype.CheckResult = function (test, aisin, aisout, controls) {
    var slot;
    var count=0;
    console.log ("\nChecking: [%s] --> [%s]", test, aisin.nmea);
    for (var element in controls){
        slot = controls[element];
        var differ = (typeof aisin[slot] === 'object')
            ? JSON.stringify(aisout[slot]) !== JSON.stringify(aisin[slot])
            : aisout[slot] !== aisin[slot];
        if (differ) {
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
            for (var part = 0; part < aisTest.nmea.length; part++) {
                var aisDecoded = new AisDecode(aisTest.nmea[part], session);
            }
        } else {
            var aisDecoded = new AisDecode(aisTest.nmea);
        }

        if (aisDecoded.valid !== true) {
            console.log ("\n[%s] invalid AIS payload: %s", test, aisDecoded.error);
        } else {
            switch (aisTest.aistype) {
                case 1:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'sog', 'cog', 'rot', 'smi']);
                    break;
                case 4:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat']);
                    break;
                case 5:
                    this.CheckResult (test, aisTest, aisDecoded, ["shipname", 'callsign', 'destination', 'cargo', 'draught', 'dimA', 'dimB', "dimC", 'dimD']);
                    break;
                case 9:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'alt', 'sog', 'cog']);
                    break;
                case 14:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'txt']);
                    break;
                case 18:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'cog', "sog"]);
                    break;
                case 19:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'cog', "sog", 'shipname']);
                    break;
                case 21:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'shipname', 'aidtype', 'lat', 'lon', 'txt', 'offpos', 'virtual']);
                    break;
                case 24:
                    switch (aisTest.part) {
                        case 0: this.CheckResult(test, aisTest, aisDecoded, ["shipname"]); break;
                        case 1: this.CheckResult(test, aisTest, aisDecoded, ['callsign', 'cargo', 'dimA', 'dimB', "dimC", 'dimD']); break;
                        default: console.log ("hoop test=[%s] message type=[%d] invalid part number [%s]", test, aisTest.type, aisDecoded.part);
                        }
                    break;
                case 8:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'length', 'width', 'draught', 'shiptypeERI']);
                    break;
                case 800111:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'avgwindspd', 'winddir', 'airtemp', 'watertemp']);
                    break;
                case 800131:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'avgwindspd', 'winddir', 'airtemp', 'watertemp', 'waterlevel']);
                    break;
                case 800122:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'mmsikey', 'linkid', 'noticetype', 'month', 'day', 'hour', 'minute', 'duration', 'txt', 'subareas']);
                    break;
                case 836722:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'mmsikey', 'version', 'action', 'linkid', 'noticetype', 'month', 'day', 'hour', 'minute', 'duration', 'txt', 'subareas']);
                    break;
                case 836733:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'siteid', 'lon', 'lat', 'avgwindspd', 'winddir']);
                    break;
                case 27:
                    this.CheckResult (test, aisTest, aisDecoded, ["mmsi", 'lon', 'lat', 'cog', "sog", 'navstatus']);
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
    var session={}
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            case '\n': // new line
                count ++;
                console.log ("line[%d]=%s", count,  line);
                var ais= new AisDecode (line, session);
                switch (ais.aistype) {
                    case 1:
                    case 2:
                    case 3:
                    case 18:
                        console.log (' -->msg-18 mmsi=%s Lon=%d Lat=%d Speed=%d Course=%d, NavStatus=%s/%s'
                            , ais.mmsi, ais.lon, ais.lat, ais.sog, ais.cog, ais.navstatus, ais.GetNavStatus());
                        break;
                    case 24:
                        console.log (' -->msg-24 mmsi=%s shipname=%s callsign=%s cargo=%s/%s length=%d width=%d'
                            , ais.mmsi,ais.shipname, ais.callsign, ais.cargo, ais.GetVesselType(),  ais.length, ais.width);
                        break;
                    case 5:
                        console.log (' -->msg-05 mmsi=%s shipname=%s callsign=%s cargo=%s/%s draught=%d length=%d width=%d'
                            , ais.mmsi,ais.shipname, ais.callsign, ais.cargo, ais.GetVesselType(),ais.draught, ais.length, ais.width);
                        break;
                    case 14:
                        console.log (' -->msg-14 mmsi=%s text=%s'
                            , ais.mmsi,ais.txt);
                        break;
                    case 4:
                    case 11:
                        console.log (' -->msg-%d mmsi=%s Lon=%d Lat=%d'
                            , ais.aistype, ais.mmsi, ais.lon, ais.lat );
                        break;
                    case 9:
                        console.log (' -->msg-09 mmsi=%s Lon=%d Lat=%d Alt=%d'
                            , ais.mmsi, ais.lon, ais.lat, ais.alt );
                        break;
                    case 19:
                        console.log (' -->msg-19 mmsi=%s Lon=%d Lat=%d Speed=%d Course=%d Name=%s'
                            , ais.mmsi, ais.lon, ais.lat, ais.sog, ais.cog, ais.shipname );
                        break;
                    case 21:
                        console.log (' -->msg-21 mmsi=%s Lon=%d Lat=%d Name=%s'
                            , ais.mmsi, ais.lon, ais.lat, ais.shipname );
                        break;
                    case 8:
                        if (ais.dac === 200 && ais.fid === 10) {
                            console.log (' -->msg-08 mmsi=%s length=%d width=%d draught=%d shiptype=%s/%s'
                                , ais.mmsi, ais.length, ais.width, ais.draught, ais.shiptypeERI, ais.GetERIShiptype(ais.shiptypeERI) );
                        } else if ((ais.dac === 1 && ais.fid === 11) ||
                                   (ais.dac === 1 && ais.fid === 31) ||
                                   (ais.dac === 367 && ais.fid === 33)) {
                            //console.log (' -->msg-08 mmsi=%s dac=%d fid=%d meteo winddir=%d avgwindspd=%d airtemp=%d watertemp=%d'
                            //    , ais.mmsi, ais.dac, ais.fid, ais.winddir, ais.avgwindspd, ais.airtemp, ais.watertemp );
                            ais.bitarray = undefined;                            
                            ais.payload = undefined;                            
                            console.log (' -->msg-meteo ' + JSON.stringify(ais) );
                        } else {        
                            console.log (' -->msg-08 mmsi=%s dac=%d fid=%d shiptype=%s/%s'
                                , ais.mmsi, ais.dac, ais.fid, ais.width,ais.shiptypeERI, ais.GetERIShiptype(ais.shiptypeERI) );
                        }
                        break;
                    case 27:
                        console.log (' -->msg-27 mmsi=%s Lon=%d Lat=%d Speed=%d Course=%d state=%d/%s'
                            , ais.mmsi, ais.lon, ais.lat, ais.sog, ais.cog, ais.navstatus, ais.GetNavStatus() );
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
if (process.argv[1] === __filename && process.argv.length === 3 ) {
    var test= new AisEncodeDecodeTest ();
    test.CheckFile (process.argv[2]);
} else if (process.argv[1] === __filename)  {
    var test= new AisEncodeDecodeTest ();
    test.CheckDecode();
    test.CheckEncode();
    //test.CheckFile ('FeedSample/AisHubSample.nmea');
}

module.exports = AisEncodeDecodeTest; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
