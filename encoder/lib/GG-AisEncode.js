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
 *  Gpsd   : http://catb.org/gpsd/AIVDM.html
 *  OpenCPN: https://github.com/OpenCPN/OpenCPN [AIS_Bitstring.cpp]
 *  http://fossies.org/linux/misc/gpsd-3.11.tar.gz/gpsd-3.11/test/sample.aivdm
 *  Online AIS decoder http://www.maritec.co.za/tools/aisvdmvdodecoding/
 *  Danish Maritime Authority https://github.com/dma-ais/AisLib (dma/ais/message)
 */

'use strict';


/* Ais payload is represented in a 6bits encoded string !(
 * This method is a direct transcription in nodejs of C++ ais-decoder code
 * Danish Maritime Authority AisLib encoding/decoding java library
 */
function AisEncode (msg) {
    this.payload = new Buffer(425); // make a buffer force it 6bit/zero
    this.payload.fill (0x0);        // init to 6bits encoded zero value
    this.payloadSize =0;            // Payload size depend on messages
    this.nmea =[];

    this.PutInt (msg.aistype  ,0,6);
    this.PutInt (msg.repeat   ,6,2);
    this.PutInt (msg.mmsi     ,8,30);
    var lat; var lon; var sog; var hdg; var accuracy; var rot;

    switch (msg.aistype) {
        case 1:
        case 2:
        case 3: // class A position report
            this.class      = 'A';
            this.PutInt(msg.navstatus, 38, 4 );

            // move lat to integer and take care of negative value
            lon = parseInt (msg.lon * 600000);
            if (lon < 0) lon |= 0x08000000;    // on 28 bits
            this.PutInt(lon, 61, 28 );

            lat = parseInt (msg.lat * 600000); // on 27 bits
            if (lat < 0) lat |= 0x04000000;
            this.PutInt(lat, 89, 27 );

            rot=parseInt (msg.rot);  //Rate of turn
            this.PutInt (rot,  42, 8 );

            sog=parseInt (msg.sog *10);  //speed over ground
            this.PutInt (sog,  50, 10 );

            cog=parseInt (msg.cog *10);  //course over ground
            this.PutInt (cog,  116, 12 );

            hdg=parseInt (msg.hdg) || parseInt (msg.cog); //magnetic heading
            this.PutInt (hdg,  128, 9 );

            this.PutInt  (60,  137, 6 );  // 60 if time stamp is not available
            this.PutInt  (msg.smi, 143, 2);

            this.payloadSize=168;   // pad with zero non used flags

            break;
        case 18: // class B position report
            this.class  = 'B';

            sog=parseInt (msg.sog *10);  //speed over ground
            this.PutInt (sog,  46, 10 );

            accuracy= parseInt (msg.accuracy);
            this.PutInt(accuracy, 56, 1 );

            // move lat to integer and take care of negative value
            lon = parseInt (msg.lon * 600000); //Long 1/10000 minute
            if (lon < 0) lon |= 0x08000000;
            this.PutInt(lon, 57, 28 );

            lat = parseInt (msg.lat * 600000); //Lat 1/10000 minute
            if (lat < 0) lat |= 0x04000000;
            this.PutInt(lat, 85, 27 );

            var cog=parseInt (msg.cog *10);  //course over ground
            this.PutInt (cog,  112, 12 );

            hdg=parseInt (msg.hdg)|| parseInt (msg.cog);      //magnetic heading
            this.PutInt (hdg,  124, 9 );

            this.PutInt  (60,  133, 6 );  // 60 [time stamp is not available]

            this.payloadSize=168;   // pad with zero non used flags
            break;
        case 5:
            this.class  = 'A';
//          Get the AIS Version indicator
//          0 = station compliant with Recommendation ITU-R M.1371-1
//          1 = station compliant with Recommendation ITU-R M.1371-3
//          2-3 = station compliant with future editions

            this.PutInt (1,38, 2); // version station =1
            this.PutInt (msg.imo     ,40, 30);
            this.PutStr (msg.callsign,70, 42);
            this.PutStr (msg.shipname,112, 120);
            this.PutInt (msg.cargo   ,232, 8);
            this.PutInt (msg.dimA    ,240, 9);
            this.PutInt (msg.dimB    ,249, 9);
            this.PutInt (msg.dimC    ,258, 6);
            this.PutInt (msg.dimD    ,264, 6);
            this.PutInt (msg.etaMo   ,274, 4);
            this.PutInt (msg.etaDay  ,278, 5);
            this.PutInt (msg.etaHr   ,283, 5);
            this.PutInt (msg.etaMin  ,288, 6);
            var draught = parseInt (msg.draught*10);
            this.PutInt((parseInt(draught*10)), 294, 8);
            this.PutStr(msg.destination,302,120);
            this.payloadSize=422;
            break;
      
        case 21:
            this.PutInt(msg.aid_type, 38, 5);
            this.PutStr(msg.atonname, 43, 120);
            accuracy= parseInt (msg.accuracy);
            this.PutInt(accuracy,     163, 1);
      
            lon = parseInt (msg.lon * 600000); //Long 1/10000 minute
            if (lon < 0) lon |= 0x08000000;
            this.PutInt(lon, 164, 28 );
      
            lat = parseInt (msg.lat * 600000); //Lat 1/10000 minute
            if (lat < 0) lat |= 0x04000000;
            this.PutInt(lat, 192, 27 );

            this.PutInt (msg.dimA     ,219, 9);
            this.PutInt (msg.dimB     ,228, 9);
            this.PutInt (msg.dimC     ,237, 6);
            this.PutInt (msg.dimD     ,243, 6);

            this.PutInt (60           ,253, 6 ); // 60 if time stamp is not available
            this.PutInt (msg.off_position, 259, 1);
            this.PutInt (msg.raim     ,268, 1);
            this.PutInt (msg.virtual_aid, 269, 1);
            this.PutInt (msg.assigned ,270, 1);
            break;
      
        case 24:  // Vesel static information
            this.class='B';
            this.PutInt(msg.part, 38, 2 );
            if (msg.part===0) {
                this.PutStr(msg.shipname, 40, 120);
                this.payloadSize=160;
            } else if ( msg.part === 1) {
                this.PutInt(msg.cargo   , 40, 8 );
                this.PutStr(msg.callsign, 90, 42);
                this.PutInt (msg.dimA, 132, 9 );
                this.PutInt (msg.dimB, 141, 9 );
                this.PutInt (msg.dimC, 150, 6 );
                this.PutInt (msg.dimD, 156, 6 );
                this.payloadSize=168; // ignore last flags
            } else {
                // message part missing
                this.valid=false;
            }
            break;
        case 25:  // single slot Binary message
            this.class='B';
            this.PutInt(1, 38, 1 ); // single destination
            this.PutInt(msg.mmsi   , 40, 20 ); // we self ping only
            this.payloadSize=168; // ignore last flags
            break;
        default:
            // not implemented
            this.valid=false;
            return;
    }

    // Make sure we finish on a byte boundary
    var size= parseInt(this.payloadSize/6);
    if (this.payloadSize%6 > 0) size++;
    for(var i = 0; i < size ; i++) {
        var chr = this.payload[i];

        // move to printable char from wacky AIS/IEC 6 bit representation
        if (chr < 40) {
            this.payload[i] = chr +48;
        } else {
            this.payload[i] = chr +56;
        }
    }

    // Finish nmea message !AIVDM,1,1,,B,B69>7mh0?J<:>05B0`0e;wq2PHI8,0*3D'
    // this.fragcnt = nmea[1];  // fragment total count for this message
    // this.fragnum = nmea[2];  // fragment number
    // this.fragid  = nmea[3];  // fragment sequential index for multipart message
    // this.pading  = nmea[6].split ('*')[0];
    var nmea=[];
    nmea [0] = '!AIVDM';  // ! is added after checksum
    nmea [1]  = '1';      // ignore multipart extention messages
    nmea [2]  = '1';
    nmea [3]  = '';
    nmea [4]  = 'A';     // this is VHF channel and not AIS class
    nmea [5]  = this.payload.toString("utf8", 0, size);
    nmea [6]  = 0;
    var paquet = nmea.toString();

    var checksum = 0; // http://rietman.wordpress.com/2008/09/25/how-to-calculate-the-nmea-checksum/
    for(var i = 1; i < paquet.length; i++) {
        checksum = checksum ^ paquet.charCodeAt(i);
    }

    var trailer;
    if (checksum < 16)  trailer= "*0" + checksum.toString(16).toUpperCase();
    else trailer= "*" + checksum.toString(16).toUpperCase();

    this.nmea =  paquet + trailer;
    this.valid=  true;
}


// Warning: a bug remaims, if you invert order of placing in between
// cog and hdg then cog value is broken. Not an issue for now, but
// should be fixed in order to encode others AIS messages
AisEncode.prototype.PutInt = function (number, start, len) {
    var c0, tp, ti, ts, t0;
    if (number  === undefined) return; // nothing garantie that will have a valid number

    // keep track of payload size
    if ((start+len) > this.payloadSize) this.payloadSize= start+len;

    for (var i=0; i < len; i++)  {
        // search the right bit within our tempry number
        c0 = (number >> i) & 1;   // bit at byte/bit index

        if (c0 !== 0) { // if null nothing to do as we filled up output number with zero
            // place out bit within destination output number
            tp = parseInt ((start + len - i -1) / 6);    // byte index within destination target
            ti = len - i -1;
            ts = 5 - (start + ti) % 6;                   // bit index to set within targeted byte
            t0 = 1 << ts;                                // shift bit to the right destination
            this.payload[tp] |= t0;                            // update output target
        }
    }
};

// Extract a string from payload [1st bits is index 0]
AisEncode.prototype.PutStr = function (string, start, len) {
    var cx,c0,tp,ts,t0;

    //console.log ('PutStr string=%s start=%d len=%d', string, start, len);
    if (string === undefined) return; // nothing garantie that will have a valid string
    string=string.toUpperCase();

    // keep track of payload size
    if ((start+len) > this.payloadSize) this.payloadSize= start+len;

    // give priority to provided bit/len but reduce it is string is smaller
    var len = parseInt (len/6);
    if (len > string.length) len=string.length;
    var bitidx=start;

    // loop on every string string characters until 1st len limit
    for (var idx=0; idx < len; idx++)  {
        cx  = string.charCodeAt (idx);  // current char to work with

        // loop on each character bit
        for (var j=5; j >= 0; j--) {
            c0 = (cx >> j) & 1;    // get bit value

            if (c0 !== 0) { // if null nothing to do as we filled up output buffer with zero
                // place out bit within destination output string
                tp = parseInt (bitidx/6);                  // byte index at target
                ts = 5 - (bitidx % 6);                     // bit index to set within targeted byte
                t0 = 1 << ts;                              // shift bit to the right destination
                this.payload[tp] |= t0;                          // update output target

            }
            bitidx++; // next bit possition in target
        }
    }
};


AisEncode.prototype.GetNavStatus =function () {
    return (NAV_STATUS [this.navstatus]);
};

AisEncode.prototype.Getaistype =function () {
    return (MSG_TYPE [this.aistype]);
};

AisEncode.prototype.GetVesselType =function () {
    return (VESSEL_TYPE [this.cargo]);
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    var AisEncodeDecodeTest = require ('../test/AisEncodeDecodeTest');
    var test= new AisEncodeDecodeTest ();
    test.SetAisEncode(AisEncode); // force test loading this active dev class
    test.CheckEncode();
}

module.exports = AisEncode; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
