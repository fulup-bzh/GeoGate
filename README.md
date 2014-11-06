GeoGate  [previously GpsdTracking]
==================================

GeoGate is an opensource tracking GPS/AIS framework to implement GTS applications.
It enables easy integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handles multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

Main features are: 
 - multiple storage backends: MySql, FlatFile, etc..
 - support tcp/socket tracker devices: gps103,traccar,nmea, ....
 - support http/gprmc android/iphone: CellTrac, OpenGTSClient, GerGTSTracker
 - support tcp/client mode request AIShub, MarineTraffic, Gpsd/Jason, ....
 - support Ajax/HTTP and WebSock profile
 - support full set of commands [reset alarm, upload SD, etc ...]
 - global vision of every active devices independently of adapter/protocols
 - support broadcast mode to send a global commands [ie: track all]
 - <telnet console> for remote supervision
 - commands queue with automatic retry when device not present
 - provide save storage space mode. No waypoints store when target move less than xxxx
 - provide a GpsSimulator to emulate NMEA/AIS devices from GPX route files
 - support AIS 6bit encoding decoding for static vessel and navigation report
 - simulator for multiple AIS target
 - flatfile backend generates standard GPX files from input tracking feeds
 Etc.

![GeoGate Leaflet Demo](http://breizhme.org/GeoGate/doc/GeoGate-selectionx800.png "Sample of GeoJason/Ajax IU with Leaflet")
http://breizhme.org/gpsdtracking/html/index.html [GeoGate Demo HomePage]

Migration of GpsdTracking to new GeoGate repo in process. Sorry for the confusion it may create.