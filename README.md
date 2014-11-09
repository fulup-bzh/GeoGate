GeoGate Global Readme
======================

GeoGate is an opensource GPS/AIS tracking server framework, that enable easy
integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handle multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

Geogate componants that can be used/customized independently.

GeoGate-Encode
===============
 - Encode/Decode NMEA GRPMC and AIS AIVDM messages

   npm install ggencoder

GeoGate-Simulator
==================

Is the component that simulate a GPS/AIS receiver/transponder.

 - lib/GG-Simulator read GPX route, interpolate intermediary points and publish event with intermediate waypoints
 - bin/DevSimulator simulates a single GPS/AIS device from a single GPX route
 - app/HubSimulator an example of application leveraging GG-Simulator that emulate an AIS/HUB activities using every GPX file found in a directory
 - AIS/NMEA encoding packet is handled by GeoGate-Encoder module

   npm install ggsimulator

Note: GeoGate is a modular version of what was used to be GpsdTracking.