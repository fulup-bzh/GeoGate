Under GeoGate adapters take care of:
  - devices network protocol
  - device specific commands

GeoGate Provides 3 classes of adapters

1) SockClient
--------------
In SockClient mode devices are clients and geogate is a server. When a new client popup
we instantiate a "GpsClientSock" object to handle device data. The class is widely
use by trackers GPS devices [ie: TK102,103 GPS103, ....]

In SockClient mode geogate authenticates client once at initialisation time
of TCP session and later leverage network socket to keep track of device session.
When network session is close we logout device.

Most trackers hardware devices implement some flavour of CVS/NMEA protocol. Depending
on the brand/model you selected, interfacing yours might be easy or not.

2) HttpClient
--------------
Like in previous case in HttpClient mode trackers remain clients and geogate a server.
Nevertheless this time we leverage a get/post request using HTTP protocol.
In this mode devices may close TCP session in between each update. As a result
we cannot leverage socket context to keep track of user session. We use DevID
that has to present in each header of HTTP request.

This model is used by many Phone applications that leverage NMEA/GPRMC within
a post/get through HTTP protocol. Android CellTrackFree is a good candidate
to start a test.

3) SockClient
---------------
This time GeoGate is client of a remote server. This model is not use by devices, but
by AIS services, like AIShub, MarineTraffic, etc ... In this model Gpsd supports
2 adapters:
 - AISTcp  request a remote AIS feed in NMEA through a single TCP socket [AIShub case]
 - GPRMC   request a remote NMEA/GPRMC to get a vessel position.

 Note: this mode is very handy for test, as you can connect on public sources.

Testing your adapter
---------------------
This safest and easiest way to test an adapter is to make a capture of real packets
    socat -u TCP-LISTEN:1234,reuseaddr OPEN:/tmp/MyOutputFile.dat,creat

Then to replay your packet with socat until your adapter successfully parse them
    socat -u /tmp/MyOutputFile.dat TCP:localhost:5003

Note: socat is a standard Linux tool, and a simple aptget, zypper, yum should install it.

Reference for GPS protocols https://www.traccar.org/protocols/



 