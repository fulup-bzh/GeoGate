GeoGate
========

GeoGate is an opensource GPS/AIS tracking server framework, that enable easy
integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handle multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

GeoGate-Sms-Gateway
===================

Is the component that provide a REST/HTTP interface to GeoGate SMS-C


Dependencies
==============
    nodejs + npm

Online Demo
============
    http://breizhme.org/gpsdtracking/html/index.html

Modules
========

* ggserver: Tracker/GPS/AIS server. It receives packet from GPRS network and write them on disk thought MySQL or MogoDB database backend.
* ggencoder: AIS & NMEA encoding decoding for GeoGate. This component is fully independent of GeoGate and can be use without any other references to GeoGate
* ggsimulator: GPS/AIS receiver/transceiver emulator. It can either emulates a single or multiple devices.
* ggsmsc: Node client interface with Gammu SMS/gateway. It is used for tracker initial configuration by SMS. This module leverages MySQL Gammy backend to exchange with the gateway.
* ggsmsg:SmsGateway provides a REST/HTTP interface to ggsmsc.
* aisweb: Display AIS target into a WebView using OpenSeaMap

Check module Readme for further informations.