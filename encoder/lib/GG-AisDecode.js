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
 *  online AIS decoder http://www.maritec.co.za/tools/aisvdmvdodecoding/
 */
'use strict';

var DEBUG = false;

var MSG_TYPE = {
    1:  "Position Report Class A",
    2:  "Position Report Class A (Assigned schedule)",
    3:  "Position Report Class A (Response to interrogation)",
    4:  "Base Station Report",
    5:  "Static and Voyage Related Data",
    6:  "Binary Addressed Message",
    7:  "Binary Acknowledge",
    8:  "Binary Broadcast Message",
    9:  "Standard SAR Aircraft Position Report",
   10:  "UTC and Date Inquiry",
   11:  "UTC and Date Response",
   12:  "Addressed Safety Related Message",
   13:  "Safety Related Acknowledgement",
   14:  "Safety Related Broadcast Message",
   15:  "Interrogation",
   16:  "Assignment Mode Command",
   17:  "DGNSS Binary Broadcast Message",
   18:  "Standard Class B CS Position Report",
   19:  "Extended Class B Equipment Position Report",
   20:  "Data Link Management",
   21:  "Aid-to-Navigation Report",
   22:  "Channel Management",
   23:  "Group Assignment Command",
   24:  "Static Data Report",
   25:  "Single Slot Binary Message,",
   26:  "Multiple Slot Binary Message With Communications State",
   27:  "Position Report For Long-Range Applications"
};

var NAV_STATUS = {
    0:  "Under way using engine",
    1:  "At anchor",
    2:  "Not under command",
    3:  "Restricted manoeuverability",
    4:  "Constrained by her draught",
    5:  "Moored",
    6:  "Aground",
    7:  "Engaged in Fishing",
    8:  "Under way sailing",
    9:  "Reserved for future amendment of Navigational Status for HSC",
   10: "Reserved for future amendment of Navigational Status for WIG",
   11: "Reserved for future use",
   12: "Reserved for future use",
   13: "Reserved for future use",
   14: "AIS-SART is active",
   15: "Not defined (default)"
};

var VESSEL_TYPE= {
     0: "Not available (default)",
    // 1-19 Reserved for future usage
    20: "Wing in ground (WIG), all ships of this type",
    21: "Wing in ground (WIG), Hazardous category A",
    22: "Wing in ground (WIG), Hazardous category B",
    23: "Wing in ground (WIG), Hazardous category C",
    24: "Wing in ground (WIG), Hazardous category D",
    25: "Wing in ground (WIG), Reserved for future use",
    26: "Wing in ground (WIG), Reserved for future use",
    27: "Wing in ground (WIG), Reserved for future use",
    28: "Wing in ground (WIG), Reserved for future use",
    29: "Wing in ground (WIG), Reserved for future use",
    30: "Fishing",
    31: "Towing",
    32: "Towing: length exceeds 200m or breadth exceeds 25m",
    33: "Dredging or underwater ops",
    34: "Diving ops",
    35: "Military ops",
    36: "Sailing",
    37: "Pleasure Craft",
    38: "Reserved",
    39: "Reserved",
    40: "High speed craft (HSC), all ships of this type",
    41: "High speed craft (HSC), Hazardous category A",
    42: "High speed craft (HSC), Hazardous category B",
    43: "High speed craft (HSC), Hazardous category C",
    44: "High speed craft (HSC), Hazardous category D",
    45: "High speed craft (HSC), Reserved for future use",
    46: "High speed craft (HSC), Reserved for future use",
    47: "High speed craft (HSC), Reserved for future use",
    48: "High speed craft (HSC), Reserved for future use",
    49: "High speed craft (HSC), No additional information",
    50: "Pilot Vessel",
    51: "Search and Rescue vessel",
    52: "Tug",
    53: "Port Tender",
    54: "Anti-pollution equipment",
    55: "Law Enforcement",
    56: "Spare - Local Vessel",
    57: "Spare - Local Vessel",
    58: "Medical Transport",
    59: "Noncombatant ship according to RR Resolution No. 18",
    60: "Passenger, all ships of this type",
    61: "Passenger, Hazardous category A",
    62: "Passenger, Hazardous category B",
    63: "Passenger, Hazardous category C",
    64: "Passenger, Hazardous category D",
    65: "Passenger, Reserved for future use",
    66: "Passenger, Reserved for future use",
    67: "Passenger, Reserved for future use",
    68: "Passenger, Reserved for future use",
    69: "Passenger, No additional information",
    70: "Cargo, all ships of this type",
    71: "Cargo, Hazardous category A",
    72: "Cargo, Hazardous category B",
    73: "Cargo, Hazardous category C",
    74: "Cargo, Hazardous category D",
    75: "Cargo, Reserved for future use",
    76: "Cargo, Reserved for future use",
    77: "Cargo, Reserved for future use",
    78: "Cargo, Reserved for future use",
    79: "Cargo, No additional information",
    80: "Tanker, all ships of this type",
    81: "Tanker, Hazardous category A",
    82: "Tanker, Hazardous category B",
    83: "Tanker, Hazardous category C",
    84: "Tanker, Hazardous category D",
    85: "Tanker, Reserved for future use",
    86: "Tanker, Reserved for future use",
    87: "Tanker, Reserved for future use",
    88: "Tanker, Reserved for future use",
    89: "Tanker, No additional information",
    90: "Other Type, all ships of this type",
    91: "Other Type, Hazardous category A",
    92: "Other Type, Hazardous category B",
    93: "Other Type, Hazardous category C",
    94: "Other Type, Hazardous category D",
    95: "Other Type, Reserved for future use",
    96: "Other Type, Reserved for future use",
    97: "Other Type, Reserved for future use",
    98: "Other Type, Reserved for future use",
    99: "Other Type, no additional information"
};


// Ais payload is represented in a 6bits encoded string !(
// This method is a direct transcription in nodejs of C++ ais-decoder code
function AisDecode (input, session) {
    this.bitarray = [];
    this.valid = false; // will move to 'true' if parsing succeed
    this.error = "";    // for returning error message if not valid

    if (Object.prototype.toString.call(input) !== "[object String]") {
        this.error = "AisDecode: Sentence is not of type string.";
        return;
    } else {
        input = input.trim();
    }

    if (input.length === 0) {
        this.error = "AisDecode: Sentence is empty or spaces.";
        return;
    } else if (!this.validateChecksum(input)) {
        this.error = "AisDecode: Sentence checksum is invalid.";
        return;
    }

    // split nmea message !AIVDM,1,1,,B,B69>7mh0?J<:>05B0`0e;wq2PHI8,0*3D'
    var nmea = input.split(",");

    if (nmea.length !== 7) {
        this.error = "AisDecode: Sentence contains invalid number of parts.";
        return;
    } 
    var command = nmea[0].substring(3,6);
    if (command !== "VDM" &&  // AIVDM: others
        command !== "VDO"     // AIVDO: own AIS
        ) {
        this.error = "AisDecode: Invalid message prefix.";
        return;
    }

    // the input string is part of a multipart message, make sure we were
    // passed a session object.
    var message_count = Number(nmea[1]);
    var message_id = Number(nmea[2]);
    var sequence_id = nmea[3].length > 0 ? Number(nmea[3]) : NaN;

    if(message_count > 1) {
        if(Object.prototype.toString.call(session) !== "[object Object]") {
           throw "A session object is required to maintain state for decoding multipart AIS messages.";
        }

        if(message_id > 1) {
            if(nmea[0] !== session.formatter) {
                this.error = "AisDecode: Sentence does not match formatter of current session.";
                return;
            }

            if(session[message_id - 1] === undefined) {
                this.error = "AisDecode: Session is missing prior message part, cannot parse partial AIS message.";
                return;
            }

            if(session.sequence_id !== sequence_id) {
                this.error = "AisDecode: Session IDs do not match. Cannot recontruct AIS message.";
                return;
            }
        } else {
            session.formatter = nmea[0];
            session.message_count = message_count;
            session.sequence_id = sequence_id;
        }
    }

    // extract binary payload and other usefull information from nmea paquet
    this.payload  = new Buffer (nmea [5]);
    this.msglen   = this.payload.length;

    this.channel = nmea[4];  // vhf channel A/B

    if(message_count > 1) {
        session[message_id] = {payload: this.payload, length: this.msglen};

        // Not done building the session
        if(message_id < message_count) return;

        var payloads = [];
        var len = 0;

        for(var i = 1; i <= session.message_count; ++i) {
            payloads.push(session[i].payload);
            len += session[i].length;
        }
        
        this.payload = Buffer.concat(payloads, len);
        this.msglen = this.payload.length;
    }

    
    // decode printable 6bit AIS/IEC binary format
    for(var i = 0; i < this.msglen; i++) {
        var byte = this.payload[i];

        // check byte is not out of range
        if ((byte < 0x30) || (byte > 0x77))  return;
        if ((0x57 < byte) && (byte < 0x60))  return;

        // move from printable char to wacky AIS/IEC 6 bit representation
        byte += 0x28;
        if(byte > 0x80)  byte += 0x20;
        else             byte += 0x28;
        this.bitarray[i]=byte;
    }

    this.aistype   = this.GetInt (0,6);
    this.repeat    = this.GetInt (6,2);
    this.immsi     = this.GetInt (8,30);
    this.mmsi      = ("000000000" + this.immsi).slice(-9);

    switch (this.aistype) {
        case 1:
        case 2:
        case 3: // class A position report
            this.class      = 'A';
            this.navstatus  = this.GetInt( 38, 4);

            var lon         = this.GetInt(61, 28);
            if (lon & 0x08000000 ) lon |= 0xf0000000;
            lon = parseFloat (lon / 600000);

            var lat = this.GetInt(89, 27);
            if( lat & 0x04000000 ) lat |= 0xf8000000;
            lat = parseFloat (lat / 600000);

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;

            this.rot = this.GetInt( 42, 8, true )                   // Rate of turn
            this.sog = this.GetInt(  50, 10) / 10;                  //speed over ground
            this.cog = this.GetInt( 116, 12) / 10;                  //course over ground
            this.hdg = parseFloat (this.GetInt( 128,  9));          //magnetic heading
            this.utc = this.GetInt( 137, 6 );
            this.smi = this.GetInt( 143, 2 );
            

            break;
        case 18: // class B position report
            this.class  = 'B';
            this.status = -1;  // Class B targets have no status.  Enforce this...
            var lon = this.GetInt(57, 28 );
            if (lon & 0x08000000 ) lon |= 0xf0000000;
            lon = parseFloat (lon / 600000);

            var lat = this.GetInt(85, 27 );
            if( lat & 0x04000000 ) lat |= 0xf8000000;
            lat = parseFloat (lat / 600000);

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;

            this.sog = this.GetInt( 46, 10 ) / 10;                //speed over ground
            this.cog = this.GetInt( 112, 12) / 10;                //course over ground
            this.hdg = parseFloat (this.GetInt( 124,  9));        //magnetic heading
            this.utc = this.GetInt( 134, 6 );

            break;
        case 19: // Extended class B position report 
            this.class  = 'B';
            this.status = -1;  // Class B targets have no status.  Enforce this...
            
            var lon = this.GetInt(57, 28 );
            if (lon & 0x08000000 ) lon |= 0xf0000000;
            lon = parseFloat (lon / 600000);

            var lat = this.GetInt(85, 27 );
            if( lat & 0x04000000 ) lat |= 0xf8000000;
            lat = parseFloat (lat / 600000);

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;

            this.sog = this.GetInt( 46, 10 ) / 10;                //speed over ground
            this.cog = this.GetInt( 112, 12) / 10;                //course over ground
            this.hdg = parseFloat (this.GetInt( 124,  9));        //magnetic heading
            this.utc = this.GetInt( 133, 6 );

            this.shipname    = this.GetStr(143,120).trim();
            this.cargo       = this.GetInt(263,8);

            this.dimA   = this.GetInt(271, 9 );
            this.dimB   = this.GetInt(280, 9 );
            this.dimC   = this.GetInt(289, 6 );
            this.dimD   = this.GetInt(295, 6 );
            this.length = this.dimA + this.dimB;
            this.width  = this.dimC + this.dimD;
            
            break;
        case 5:
            this.class  = 'A';
//          Get the AIS Version indicator
//          0 = station compliant with Recommendation ITU-R M.1371-1
//          1 = station compliant with Recommendation ITU-R M.1371-3 (or later)
//          2 = station compliant with Recommendation ITU-R M.1371-5 (or later)
//          3 = station compliant with future editions
            var AIS_version_indicator = this.GetInt(38,2);
            if( AIS_version_indicator < 3 )
                {
                this.imo = this.GetInt(40,30);
                this.callsign    = this.GetStr(70,42).trim();
                this.shipname    = this.GetStr(112,120).trim();
                this.cargo       = this.GetInt(232,8);
                this.dimA        = this.GetInt(240,9);
                this.dimB        = this.GetInt(249,9);
                this.dimC        = this.GetInt(258,6);
                this.dimD        = this.GetInt(264,6);
                this.etaMo       = this.GetInt(274,4);
                this.etaDay      = this.GetInt(278,5);
                this.etaHr       = this.GetInt(283,5);
                this.etaMin      = this.GetInt(288,6);
                this.draught     = this.GetInt(294, 8 ) / 10.0;
                this.destination = this.GetStr(302, 120).trim();
                this.length      = this.dimA + this.dimB;
                this.width       = this.dimC + this.dimD;
                this.valid       = true;
            }

            break;
        case 24:  // Vesel static information
            this.class='B';
            this.part = this.GetInt(38, 2 );
            if (0 === this.part ) {
                this.shipname = this.GetStr(40, 120).trim();
                this.valid    = true;
            } else if ( this.part === 1) {
                this.cargo    = this.GetInt(40, 8 );
                this.callsign = this.GetStr(90, 42).trim();

                // 98 = auxiliary craft 
                if (parseInt(this.immsi/10000000) === 98) {
                    var mothership  = this.GetInt (132, 30);
                    this.mothership = ("000000000" + mothership).slice(-9);
                } else {
                    this.dimA   = this.GetInt(132, 9 );
                    this.dimB   = this.GetInt(141, 9 );
                    this.dimC   = this.GetInt(150, 6 );
                    this.dimD   = this.GetInt(156, 6 );
                    this.length = this.dimA + this.dimB;
                    this.width  = this.dimC + this.dimD;
                }
                this.valid  = true;
            }
            break;
        case 4:  // base station
        case 11: // UTC/Date Response
            this.class      = '-';
            
            var lon = this.GetInt(79, 28);
            if (lon & 0x08000000 ) lon |= 0xf0000000;
            lon = parseFloat (lon / 600000);

            var lat = this.GetInt(107, 27);
            if( lat & 0x04000000 ) lat |= 0xf8000000;
            lat = parseFloat (lat / 600000);

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;
            break;
        case 9: // sar aircraft
            this.class      = '-';
            
            this.alt = this.GetInt(38, 12);
            
            var lon = this.GetInt(61, 28);
            if (lon & 0x08000000 ) lon |= 0xf0000000;
            lon = parseFloat (lon / 600000);

            var lat = this.GetInt(89, 27);
            if( lat & 0x04000000 ) lat |= 0xf8000000;
            lat = parseFloat (lat / 600000);

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;
            
            this.sog = parseFloat (this.GetInt( 50, 10 ));  //speed over ground
            this.cog = this.GetInt( 116, 12) / 10;          //course over ground

            break;
        case 21: // aid to navigation 
            this.class      = '-';
            
            this.aidtype = this.GetInt(38, 5);
            this.shipname = this.GetStr(43, 120).trim();
            
            var lon = this.GetInt(164, 28);
            if (lon & 0x08000000 ) lon |= 0xf0000000;
            lon = parseFloat (lon / 600000);

            var lat = this.GetInt(192, 27);
            if( lat & 0x04000000 ) lat |= 0xf8000000;
            lat = parseFloat (lat / 600000);

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;
            
            this.dimA   = this.GetInt(219, 9 );
            this.dimB   = this.GetInt(228, 9 );
            this.dimC   = this.GetInt(237, 6 );
            this.dimD   = this.GetInt(243, 6 );
            this.length = this.dimA + this.dimB;
            this.width  = this.dimC + this.dimD;

            this.utc = this.GetInt(253, 6);
            this.offpos = this.GetInt(259, 1);
            this.virtual = this.GetInt(269, 1);

            var len = parseInt(( ( this.bitarray.length - 272 /6 ) / 6 ) * 6)*6;
            this.txt = this.GetStr(272 , len).trim();
            
            break;
        case 14: // text msg
            this.class      = '-';
            if (this.bitarray.length > 40/6) {
                var len = parseInt(( ( this.bitarray.length - 40/6 ) / 6 ) * 6)*6;
                this.txt = this.GetStr(40, len).trim();
                this.valid = true;
            }
            break;
        case 8: // Binary Broadcast Message
                this.dac = this.GetInt(40, 10 );
                this.fid = this.GetInt(50, 6 );
                // Inland ship static and voyage related data
                if (this.dac === 200 && this.fid === 10 ) {
                    this.class       = '-';
                    this.ENI         = this.GetStr(56,48).trim();
                    this.length      = parseFloat(this.GetInt(104, 13 )) /10.;
                    this.width       = parseFloat(this.GetInt(117, 10 )) /10.;
                    this.draught     = parseFloat(this.GetInt(144, 11 )) / 100.0;
                    this.shiptypeERI = this.GetInt(127, 14 );
                    this.valid       = true;
                } 
                // meteorological and hydrographic data
                else if (this.dac === 1 && this.fid === 31 ) {
                    this.class       = '-';
                    var lon = this.GetInt(56, 25);
                    if (lon & 0x08000000 ) lon |= 0xf0000000;
                    lon = parseFloat (lon / 60000); //Lon in 1/1,000 min
        
                    var lat = this.GetInt(81, 24);
                    if( lat & 0x04000000 ) lat |= 0xf8000000;
                    lat = parseFloat (lat / 60000); //Lat in 1/1,000 min
                            
                    this.utcday        = parseInt(this.GetInt(106, 5));
                    this.utchour       = parseInt(this.GetInt(111, 5));
                    this.utcminute     = parseInt(this.GetInt(116, 6));
                    this.avgwindspd    = parseInt(this.GetInt(122, 7));
                    this.windgust      = parseInt(this.GetInt(129, 7));
                    this.winddir       = parseInt(this.GetInt(136, 9));
                    this.windgustdir   = parseInt(this.GetInt(145, 9));
                    this.airtemp       = parseInt(this.GetInt(154, 11));
                    this.relhumid      = parseInt(this.GetInt(165, 7));
                    this.dewpoint      = parseInt(this.GetInt(172, 10));
                    this.airpress      = parseInt(this.GetInt(182, 9));
                    this.airpressten   = parseInt(this.GetInt(191, 2));
                    this.horvisib      = parseInt(this.GetInt(193, 8));
                    this.waterlevel    = parseInt(this.GetInt(201, 12));
                    this.waterlevelten = parseInt(this.GetInt(213, 2));
                    this.surfcurrspd   = parseInt(this.GetInt(215, 8));
                    this.surfcurrdir   = parseInt(this.GetInt(223, 9));
                    this.signwavewhgt  = parseInt(this.GetInt(276, 8));
                    this.waveperiod    = parseInt(this.GetInt(284, 6));
                    this.wavedir       = parseInt(this.GetInt(290, 9));
                    this.swellhgt      = parseInt(this.GetInt(299, 8));
                    this.swellperiod   = parseInt(this.GetInt(307, 6));
                    this.swelldir      = parseInt(this.GetInt(313, 9));
                    this.seastate      = parseInt(this.GetInt(322, 4));
                    this.watertemp     = parseInt(this.GetInt(326, 10));
                    this.precipitation = parseInt(this.GetInt(336, 3));
                    this.salinity      = parseInt(this.GetInt(339, 9));
                    this.ice           = parseInt(this.GetInt(348, 2));

                    if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                        this.lon = lon;
                        this.lat = lat;
                        this.valid = true;
                    } else this.valid = false;
                } else {
                    if (DEBUG) {
                        console.log ('---- type=%d %s dac=%d fid=%d %s', this.aistype, this.mmsi, dac, fid, input);                
                    }
                }
            break;
        case 27: // Long Range AIS Broadcast message
            this.class  = '-';
            this.navstatus  = this.GetInt( 40, 4);     
            
            var lon = this.GetInt(44, 18 );
            lon = parseFloat (lon) / 600;

            var lat = this.GetInt(62, 17 );
            lat = parseFloat (lat) / 600;

            if( ( lon <= 180. ) && ( lat <= 90. ) ) {
                this.lon = lon;
                this.lat = lat;
                this.valid = true;
            } else this.valid = false;

            this.sog = this.GetInt( 79, 6 ) ;                //speed over ground
            this.cog = this.GetInt( 85, 9);                //course over ground
            break;
        default:
            if (DEBUG) {
                console.log ('---- type=%d %s %s -> %s', this.aistype, this.Getaistype(this.aistype), this.mmsi, input);
            }
            break;
    }
}

// Validate message checksum
AisDecode.prototype.validateChecksum = function(input) {
    if (typeof input === "string") {
        var loc1 = input.indexOf("!");
        var loc2 = input.indexOf("*");

        if (loc1 === 0 && loc2 > 0) {
            var body = input.substring(1, loc2);
            var checksum = input.substring(loc2 + 1);

            for (var sum = 0, i = 0; i < body.length; i++) {
                sum ^= body.charCodeAt(i);  //xor based checksum
            }
            var hex = sum.toString(16).toUpperCase();
            if (hex.length === 1) hex = '0' + hex;      //single digit hex needs preceding 0, '0F'

            return (checksum === hex);
        }
    }
    return false;
};

// Extract an integer sign or unsigned from payload
AisDecode.prototype.GetInt= function (start, len, signed) {
    var acc = 0;
    var cp, cx,c0, cs;

    for(var i=0 ; i<len ; i++)
    {
        acc  = acc << 1;
        cp = parseInt ((start + i) / 6);
        cx = this.bitarray[cp];
        cs = 5 - ((start + i) % 6);
        c0 = (cx >> cs) & 1;

        if (i === 0 && signed && c0) { // if signed value and first bit is 1, pad with 1's
          acc = ~acc;
        }
        acc |= c0;

        //console.log ('**** bitarray[%d]=cx=%s i=%d cs=%d  co=%s acc=%s'
        //,cp , this.bitarray[cp].toString(2), i, cs,  c0.toString(2),acc.toString(2));
    }
    //console.log ('---- start=%d len=%d acc=%s acc=%d', start, len ,  acc.toString(2), acc);
    return acc;
};

// Extract a string from payload [1st bits is index 0]
AisDecode.prototype.GetStr= function(start, len) {

    // extended message are not supported
    if (this.bitarray.length < (start + len) /6) {
        //console.log ("AisDecode: ext msg not implemented GetStr(%d,%d)", start, len);
        len = parseInt(( ( this.bitarray.length - start/6 ) / 6 ) * 6)*6;
    }
    // messages in the wild sometimes produce a negative len which will cause a buffer range error
    // exception, stating size argument must not be negative. This occurs in the new Buffer() below.
    if (len < 0) {
        return '';
    }

    //char temp_str[85];
    var buffer = new Buffer(len/6);
    var cp, cx, cs,c0;
    var acc = 0;
    var k   = 0;
    var i   = 0;
    while(i < len)
    {
         acc=0;
         for(var j=0 ; j<6 ; j++)
         {
            acc  = acc << 1;
            cp =  parseInt ((start + i) / 6);
            cx = this.bitarray[cp];
            cs = 5 - ((start + i) % 6);
            c0 = (cx >> (5 - ((start + i) % 6))) & 1;
            acc |= c0;
            i++;
         }
         buffer[k] = acc; // opencpn
         if(acc < 0x20)  buffer[k] += 0x40;
         else          buffer[k] = acc;  // opencpn enfoce (acc & 0x3f) ???
         if ( buffer[k] === 0x40) break; // name end with '@'
         k++;
    }
    return (buffer.toString ('utf8',0, k));
};

AisDecode.prototype.GetNavStatus =function () {
    return (NAV_STATUS [this.navstatus]);
};

AisDecode.prototype.Getaistype =function () {
    return (MSG_TYPE [this.aistype]);
};

AisDecode.prototype.GetVesselType =function () {
    return (VESSEL_TYPE [this.cargo]);
};

// map ERI Classification to other vessel types
AisDecode.prototype.GetERIShiptype = function( shiptypeERI ) {
	switch (shiptypeERI) {
        case 8000: return 99; // Vessel, type unknown	
        case 8010: return 79; // Motor freighter
        case 8020: return 89; // Motor tanker
        case 8021: return 80; // Motor tanker, liquid cargo, type N

        case 8022: return 80; // Motor tanker, liquid cargo, type C

        case 8023: return 89; // Motor tanker, dry cargo as if liquid (e.g. cement)

        case 8030: return 79; // Container vessel

        case 8040: return 80; // Gas tanker

        case 8050: return 79; // Motor freighter, tug

        case 8060: return 89; // Motor tanker, tug

        case 8070: return 79; // Motor freighter with one or more ships alongside

        case 8080: return 89; // Motor freighter with tanker

        case 8090: return 79; // Motor freighter pushing one or more freighters

        case 8100: return 89; // Motor freighter pushing at least one tank-ship

        case 8110: return 79; // Tug, freighter

        case 8120: return 89; // Tug, tanker

        case 8130: return 31; // Tug freighter, coupled

        case 8140: return 31; // Tug, freighter/tanker, coupled

        case 8150: return 99; // Freightbarge

        case 8160: return 99; // Tankbarge

        case 8161: return 90; // Tankbarge, liquid cargo, type N

        case 8162: return 90; // Tankbarge, liquid cargo, type C

        case 8163: return 99; // Tankbarge, dry cargo as if liquid (e.g. cement)

        case 8170: return 99; // Freightbarge with containers

        case 8180: return 90; // Tankbarge, gas

        case 8210: return 79; // Pushtow, one cargo barge

        case 8220: return 79; // Pushtow, two cargo barges

        case 8230: return 79; // Pushtow, three cargo barges

        case 8240: return 79; // Pushtow, four cargo barges

        case 8250: return 79; // Pushtow, five cargo barges

        case 8260: return 79; // Pushtow, six cargo barges

        case 8270: return 79; // Pushtow, seven cargo barges

        case 8280: return 79; // Pushtow, eight cargo barges

        case 8290: return 79; // Pushtow, nine or more barges

        case 8310: return 80; // Pushtow, one tank/gas barge

        case 8320: return 80; // Pushtow, two barges at least one tanker or gas barge

        case 8330: return 80; // Pushtow, three barges at least one tanker or gas barge

        case 8340: return 80; // Pushtow, four barges at least one tanker or gas barge

        case 8350: return 80; // Pushtow, five barges at least one tanker or gas barge

        case 8360: return 80; // Pushtow, six barges at least one tanker or gas barge

        case 8370: return 80; // Pushtow, seven barges at least one tanker or gas barge
    }
	return shiptypeERI;
};

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
   var AisEncodeDecodeTest = require ('../test/AisEncodeDecodeTest');
   var test= new AisEncodeDecodeTest ();
   test.SetAisDecode(AisDecode); // force test loading this active dev class
   test.CheckDecode();
 }

module.exports = AisDecode; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

