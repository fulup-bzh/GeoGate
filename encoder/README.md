GeoGate
========

GeoGate is an opensource GPS/AIS tracking server framework, that enable easy
integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handle multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

GeoGate-Encoder
===============

Is the component that support AIS & NMEA encoding decoding for GeoGate. This component is fully
independent of GeoGate and can be use without any other references to GeoGate

Install
=======

      npm install GGencoder

Usage
======

      // import GeoGate encoding/decoding NMEA/AIS methods
      AisEncoder  = require ("GGencoder").AisEncoder;
      AisDecoder  = require ("GGencoder").AisDecoder;
      NmeaEncoder = require ("GGencoder").NmeaEncoder;
      NmeaDecoder = require ("GGencoder").NmeaDecoder;

      // decode and AIS message
      decMsg = new AisDecode (""!AIVDM,2,1,1,A,55?MbV02;H;s<HtKR20EHE:0@T4@Dn2222222216L961O5Gf0NSQEp6ClRp8,0*1C");
      if (decMsg.valid) console.log ('%j', decMsg);

      // encode AIS message
      encMsg = new AisEncode ({// class AB static info
            msgtype    : 24,
            part       : 2,
            mmsi       : 271041815,
            cargo      : 60,
            callsign   : "TC6163",
            dimA       : 0,
            dimB       : 15,
            dimC       : 0,
            dimD       : 5
      }); if (encMsg.valid) console.log (encMsg.nmea);

      // decode NMEA message
      decMsg = new NmeaDecode ('$GPGGA,064036.289,4836.5375,N,00740.9373,E,1,04,3.2,200.2,M,,,,0000*0E');
      if (decMsg.valid) console.log ('%j', decMsg);

      // encode NMEA message
      encMsg = new NmeaEncode ({ // standard class B Position report
             msgtype    : 18,
             cog        : 72.2,
             sog        : 6.1000000000000005,
             lon        : 122.47338666666667,
             lat        : 36.91968,
      }; if (encMsg.valid) console.log (encMsg.nmea);

test
=====

      cd test
      node --use_strict AisEncodeDecodeTest.js
      node --use_strict NmeaEncodeDecodeTest.js