GeoGate Simulator
=================

GeoGate is an opensource GPS/AIS tracking server framework, that enable easy
integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handle multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

GeoGate-Simulator
==================

Is the component that support GPS/AIS receiver/transceiver emulation. It can either
emulate a single or multiple devices.

Install
=======

       npm install ggsimulator

Command line
=============
       # Standalone GPS/AIS device
       node ./bin/DevSimulator.js --verbose --gpxfile=sample/gpx-file/opencpn-sample.gpx --mmsi=0 --tic=1  # MMSI=0 force GPRMC formatting
       node ./bin/DevSimulator.js --verbose --gpxfile=sample/gpx-file/opencpn-sample.gpx --mmsi=12312345 --tic=10 --shipname='Youpi' --class='A' --speed=15 --length=150 --width=10

       # One GPS and Multiple AIS targets loop for ever
       node ./bin/HubSimulator.js --gpxdir=./sample/hub-route --port=5001 --loopwait=1 --debug=3

API Usage
============
       var GGsimulator = require("ggsimulator").Simulator;
       var config =
           { gpxfile : "../sample/gpx-file/opencpn-sample.gpx"
           , mmsi    : 1234      // my prefered fake MMSI
           , tic     : 1         // send a position every 10s
           , loopwait: 0         // stop at end of gpxfile
           , debug   : 4         // [0-9] 4= see event emit without listening to them
        };
        var simulator = new GGsimulator (config);
        simulator.event.on("position",MyEventHandler4Position);   // GPS position report
        simulator.event.on("static"  ,MyEventHandler4Statics);    // AIS static data report

        // Check ./sample/geojson for a working solution with a custom message formating


API/lib
========
   require("ggsimulator").Simulator      : parses a single GPX file, generates intermediary points and emits position/statics events
   require("ggsimulator").Dispatch       : supports TCP client/server services. Dispatches outgoing messages to connected clients
   require("ggsimulator").NmeaAisEncoder : formats outgoing messages to GPRMC/AIVDM standard as requested by chart applications like OpenCPN

Sample
======
   ./sample/geojson/GeoJsonExample.js A small application that leverages a basic custom encoding.