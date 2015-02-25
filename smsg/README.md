GeoGate Simulator
=================

GeoGate is an opensource GPS/AIS tracking server framework, that enable easy
integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handle multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

GeoGate-SmsGateway
==================

SmsGateway provides a REST/HTTP interface to GeoGate SmsClient.

In order to use this module, you need a working Gammu SMS gateway and GeoGate SmsClient module
configure with MySQL backend. For details check http://fr.wammu.eu/smsd/

Install
=======
       npm install ggsmsg   [will install ggsmsc dependency]

Command line
=============
       # Edit SmsRestGateway.js to reflect your SmsClient config
       node ./bin/SmsRestGateway.js
