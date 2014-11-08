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
generate a single or multiple devices.

Install
=======

      npm install ggsimulator

Basic Usage
============
   var GGsimulator = require("ggsimulator").Simulator;
   var config =
       { gpxfile : "../sample/gpx-file/opencpn-sample.gpx"
       , mmsi    : 1234    // my prefered fake MMSI
       , tic     : 1    // send a position every 10s
       , loopwait: 0    // stop at end of gpxfile
       , debug   : 5    // 4 allow us to see event emit without officially listening to them
    };
    var simulator = new GGsimulator (config);
    simulator.event.on("position",MyEventHandler4Position);
    simulator.event.on("static"  ,MyEventHandler4Statics);

Register a custom presentation prototype [ex: CustomGeoJson]
========================================================
   opts =
        { gpxfile : "../sample/gpx-file/opencpn-sample.gpx"
        , proto   : 'MyProtoName'
        }
   var encoder   = new GGencoder   (opts);  // handle output message format
   var dispatch  = new GGdispatch (opts);  // dispatch message to tcp clients
   var simulator = new GGsimulator (opts);  // parse GPX route and compute position

   encoder.AddEncoder   ("CustomGeoJson", CustomGeoJsonEncodingMethod);
   dispatch.SetEncoder  (encoder);    // register encoders
   dispatch.SetListener (simulator);  // ask dispatcher to handle simulator position events


Lib
====
   lib/GG-Simulator is parse GPX file, generate intemediary points and emit position & statics events
   lib/GG-Presenter is an interface for supported output format AIVDM,GPRMC,JSON,....
   lib/GG-EvtHandler receive event from GG-Simulator transform with GG-presenter and send them to GG-dispatch
   lib/GG-Dispatch is a simple TCP client/server routine to dispatch final result to connected client

   If you write your own Simulator application, you may want only lib/GG-Simulator. Other libs are only helpers that
   you may or may not be interested in.

   If you only want to add a new format ex: Signal-K, GeoJSON, etc ... Write a simple encoder using CVS or jSON as example
   and register it within application config file.