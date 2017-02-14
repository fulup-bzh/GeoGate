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
    this.bitarray=[];
    this.valid= false; // will move to 'true' if parsing succeed
    var nmea = "";

    if(Object.prototype.toString.call(input) !== "[object String]") {
        return;
    }

    // split nmea message !AIVDM,1,1,,B,B69>7mh0?J<:>05B0`0e;wq2PHI8,0*3D'
    var nmea = input.split (",");

    // make sure we are facing a supported AIS message
    // AIVDM for standard messages, AIVDO for messages from own ship AIS
    if (nmea[0] !== '!AIVDM' && nmea[0] !== '!AIVDO') return;

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
                console.log ("AisDecode: Sentence does not match formatter of current session");
                return;
            }

            if(session[message_id - 1] === undefined) {
                console.log ("AisDecode: Session is missing prior message part, cannot parse partial AIS message.");
                return;
            }

            if(session.sequence_id !== sequence_id) {
                console.log ("AisDecode: Session IDs do not match. Cannot recontruct AIS message.");
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
    var immsi      = this.GetInt (8,30);
	this.mmsi      = ("000000000" + immsi).slice(-9);

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

            this.rot = this.GetInt( 42, 8, true )                 // Rate of turn
            this.sog = parseFloat (0.1 * this.GetInt(  50, 10 )); // speed over ground
            this.cog = parseFloat (0.1 * this.GetInt( 116, 12));  // course over ground
            this.hdg = parseFloat (this.GetInt( 128,  9));        // magnetic heading
            this.utc = this.GetInt( 137, 6 );
            this.smi = this.GetInt( 143, 2 );                     // special maneuvre indicator

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

            this.sog = parseFloat (0.1 * this.GetInt( 46, 10 )); //speed over ground
            this.cog = parseFloat (0.1 * this.GetInt( 112, 12)); //course over ground
            this.hdg = parseFloat (this.GetInt( 124,  9));       //magnetic heading
            this.utc = this.GetInt( 134, 6 );

            break;
        case 5:
            this.class  = 'A';
//          Get the AIS Version indicator
//          0 = station compliant with Recommendation ITU-R M.1371-1
//          1 = station compliant with Recommendation ITU-R M.1371-3
//          2-3 = station compliant with future editions
            var AIS_version_indicator = this.GetInt(38,2);
            if( AIS_version_indicator < 2 ) {
                this.imo = this.GetInt(40,30);
                this.callsign    = this.GetStr(70,42);
                this.shipname    = this.GetStr(112,120);
                this.cargo       = this.GetInt(232,8);
                this.dimA        = this.GetInt(240,9);
                this.dimB        = this.GetInt(249,9);
                this.dimC        = this.GetInt(258,6);
                this.dimD        = this.GetInt(264,6);
                this.etaMo       = this.GetInt(274,4);
                this.etaDay      = this.GetInt(278,5);
                this.etaHr       = this.GetInt(283,5);
                this.etaMin      = this.GetInt(288,6);
                this.draught     = parseFloat (this.GetInt(294, 8 ) / 10.0);
                this.destination = this.GetStr(302, 120);
                this.length      = this.dimA + this.dimB;
                this.width       = this.dimC + this.dimD;
                this.valid       = true;
            }

            break;
        case 24:  // Vesel static information
            this.class='B';
            this.part = this.GetInt(38, 2 );
            if (0 === this.part ) {
                this.shipname = this.GetStr(40, 120);
                this.valid    = true;
            } else if ( this.part === 1) {
                this.cargo    = this.GetInt(40, 8 );
                this.callsign = this.GetStr(90, 42);

                this.dimA   = this.GetInt(132, 9 );
                this.dimB   = this.GetInt(141, 9 );
                this.dimC   = this.GetInt(150, 6 );
                this.dimD   = this.GetInt(156, 6 );
                this.length = this.dimA + this.dimB;
                this.width  = this.dimC + this.dimD;
                this.valid  = true;
            }
            break;
        case 4: // base station
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
        case 21: // aid to navigation 
            this.class      = '-';
			
			this.aidtype = this.GetInt(38, 5);
			this.shipname = this.GetStr(43, 120);
			
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
			break;
        default:
    }
}

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
}

// Extract a string from payload [1st bits is index 0]
AisDecode.prototype.GetStr= function(start, len) {

    // extended message are not supported
    if (this.bitarray.length < (start + len) /6) {
        //console.log ("AisDecode: ext msg not implemented GetStr(%d,%d)", start, len);
        return;
    }

    //char temp_str[85];
    var buffer = new Buffer(20);
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


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
   var AisEncodeDecodeTest = require ('../test/AisEncodeDecodeTest');
   var test= new AisEncodeDecodeTest ();
   test.SetAisDecode(AisDecode); // force test loading this active dev class
   test.CheckDecode();
 }

module.exports = AisDecode; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

