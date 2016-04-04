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
 * Simple GPRMC/GPGGA NMEA decoder note than GPRID is a fake NMEA paquet used by GeoGateSimulator
 * Reference: http://fr.wikipedia.org/wiki/NMEA_0183
 * http://www.gpspassion.com/forumsen/topic.asp?TOPIC_ID=17661
 * http://rietman.wordpress.com/2008/09/25/how-to-calculate-the-nmea-checksum/
 * 
 */
'use strict';


function NmeaDecode (inputpaquet) {
    
    // if empty packet return
    if(Object.prototype.toString.call(inputpaquet) !== "[object String]") {
    return;
    }
    
    this.nmea = inputpaquet.split(",");
    this.valid= true; 
    
    switch (this.nmea[0]) {  
       case "\r\n":
            this.cmd="EMPTY";
            this.type=0; // ignore
            break;
        case "$FAKID":  // fake device mssi login
            // $FAKID,123456789,DummyRouteName
            this.cmd= 1; // Login
            var mmsi = this.nmea[1];
            this.mmsi=mmsi[0];
            var name = this.nmea[2];
            this.name=name[0];
            break;
        case "$GPRMC":  // position with speed and eventually no altitude
            // $GPRMC,225446.00,A,4916.45,N,12311.12,W,000.5,054.7,191194,020.3,E*68
            this.cmd= 2;  // Tracker
            this.mssi=0;
            if (this.nmea[2] !== 'A') {
                this.valid=false;
                return;
            }
            this.time = this.nmea[1];
            this.lat  =[this.nmea[3], this.nmea[4]];
            this.lon  =[this.nmea[5], this.nmea[6]];
            this.sog  = parseFloat (this.nmea[7] || 0);
            this.cog  = parseFloat (this.nmea[8] || 0);
            this.day  = this.nmea[9];
            this.alt  = parseFloat (this.nmea[10] || 0);
            break;
        case "$GPGGA":  // position with altitude and no speed
             // $GPGGA,064036.289,4836.5375,N,00740.9373,E,1,04,3.2,200.2,M,,,,0000*0E
            this.cmd = 2; // Tracker
            this.mssi=0;
            this.time = this.nmea [1];
            this.lat  =[this.nmea[2], this.nmea[3]];
            this.lon  =[this.nmea[4], this.nmea[5]];
            this.valid= this.nmea[6];
            this.sog= parseFloat (this.nmea[7] || 0);
            this.cog  = parseFloat (this.nmea[8] || 0);
            this.alt  = parseFloat (this.nmea[9] || 0);
            this.day  = undefined;   // only time in GPGGA
            break;
        default:
            this.valid = false;
    }
    
    // Standard NMEA paquet need some aditional work
    if (this.cmd === 2) { // if position cleanup dates and other data
        try {this.NormalizeData();} catch(err) {
           this.valid=false;
           console.log ("**** NmeaDecode NormalizeData Error: %s", err);
        }
        // if OK NormalizeData set valid=true
    }
}

// Clean up GPS nmeadata to make them device independant
NmeaDecode.prototype.NormalizeData= function () {
    // Convert gps coordonnates in decimal
    var Minute2Dec = function(lat){
        // TK103 sample 4737.1024,N for 47°37'.1024
        var deg= parseInt (lat[0]/100) || 0;
        var min= lat[0] - (deg*100);
        var dec= deg + (min/60);
    
        if (lat [1] === 'S' || lat [1] === 'W') dec= dec * -1;
        return (dec);
    };
    
    // we store lon/lat as +-/decimal
    this.lat = Minute2Dec (this.lat);
    this.lon = Minute2Dec (this.lon);
    
    // // $GPGGA provide time but no date
    if (this.day === undefined) {
        this.date  = new Date().getTime();
    } else { 
        // $GPRMC 100106=10-jan-2006 053740.000=5h37m40s
        var d=this.day.substring (4,6);
        var m=this.day.substring (2,4)-1;  //warning january=0 !!!
        var y='20' + this.day.substring (0,2);
        var h=this.time.substring (0,2);
        var n=this.time.substring (2,4);
        var s=this.time.substring (4,6);
        this.date = Date.UTC (y,m,d,h,n,s);
    }
    
    // move speed from knts to m/s with one decimal
    this.sog= parseInt (this.sog * 1853 / 360)/10;
    this.valid=true; // everything looks OK
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    var NmeaEncodeDecodeTest = require ('../test/NmeaEncodeDecodeTest');
    var test= new NmeaEncodeDecodeTest ();
    test.SetNmeaDecode (NmeaDecode);
    test.CheckDecode();
}

module.exports = NmeaDecode; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

