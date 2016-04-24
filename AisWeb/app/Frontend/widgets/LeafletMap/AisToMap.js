/* 
 * Copyright (C) 2015 "IoT.bzh"
 * Author "Fulup Ar Foll"
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * 
 */

(function () {
    'use strict';

var tmpl = '';

// Class to add vessel as POI on Leaflet
function DeviceOnMap (map, data) {
    this.trace=[];  // keep trace of device trace on xx positions
    this.count=0;   // number of points created for this device
    this.devid = data.devid;
    this.src   = data.src;
    this.name  = data.name;
    this.map=map;
    this.lastshow = new Date().getTime();
} 
  
DeviceOnMap.prototype.CreateCircle= function (radius) {
    var marker= L.marker([this.lat, this.lon],  {
        icon : L.divIcon({className:'vessel trace ' + this.src, iconSize:[3,3]}),
        clickable: true,
        title: this.name + ' [mmsi='+ this.devid+ ']'        
      }).addTo(this.map);
    var info= "Name=" +this.name+" mmsi="+this.devid +"<br>lat:"+this.lat.toFixed(4) +" lon:" +this.lon.toFixed(4) +
              " sog:" + this.sog.toFixed(2)+ " cog:"+ this.cog.toFixed(2)+"<br>time: " +  this.LastShow();
    marker.bindPopup("<center>"+info+"</center>");
    return (marker);
};


DeviceOnMap.prototype.LastShow =function () {
    var date=new Date(this.lastshow);
    var hours   = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
};

   // build a vector base on device heading & speed
DeviceOnMap.prototype.CreateVector =function () {
    if (this.vector) this.map.removeLayer (this.vector);

    // Create a vector lenght from this speed
    var len=2*this.sog;
    var sinDir, cosDir;

    // compute x/y direction depending on device heading
    if (this.cog < 180)  sinDir=1; else sinDir=-1;
    if (this.cog > 270 && this.cog < 90 )   cosDir=1; else cosDir=-1;
    // pts (0.0) is left uppercorner
    var pts= this.map.latLngToContainerPoint ([this.lat, this.lon]);
    var newx= parseInt (pts.x + (Math.sin(this.cog / 180)*len*sinDir));
    var newy= parseInt (pts.y + (Math.cos(this.cog* Math.PI / 180)*len*cosDir));

    this.vector=L.polyline ([[this.lat, this.lon], this.map.containerPointToLatLng(L.point(newx,newy))],
                {clickable:false, className: "vessel vector " +this.src, opacity:0.7, dashArray:[3, 10]}).addTo(this.map);
       
};

// Create a marker from device object and plate in on the map
DeviceOnMap.prototype.CreateMarker= function (status) {
    var activeclass;
    
    if (!this.lat || !this.lon) return;
    if (status) activeclass='active'; else activeclass='inactive';

    this.active=status;
    this.marker= L.marker([this.lat, this.lon],  
        { 
           icon : L.divIcon({className:'vessel lonlat ' +activeclass +' ' +this.src, iconSize:[10,10]}),
           clickable: true,
           title: this.name + ' mmsi='+ this.devid+ '['+ activeclass +']'
        }).addTo(this.map);

    var info= "Nom=<b>" + this.name + "</b> mmsi=<b>" + this.devid + "</b> " +
              "<br>Pos:<b>" + this.lat.toFixed(4) + "</b>,<b>" + this.lon.toFixed(4)  +
              "<br>LastShow=<b>" + this.LastShow() + "</b> ";
    this.marker.bindPopup("<center>"+info+"</center>");
};
   


// if no marker create on, else move it and update trace
DeviceOnMap.prototype.UpdatePos = function (data) {
    
    // no valid position just ignore
    if (!data.lat || !data.lon) return;
    this.lat = data.lat;
    this.lon = data.lon;
    this.sog = data.sog || 0;
    this.cog = data.cog || 0;
    this.lastshow = new Date().getTime();
    
    // if not active rebuilt marker
    if (!this.active) {
        if (this.marker) this.map.removeLayer (this.marker);
        this.CreateMarker(true); 
    } else {
        if (this.sog > 0) {
            // move data marker to new location
            this.marker.setLatLng ([this.lat, this.lon]);
            // add a new point to trace
            var current= this.count; 
            var next   = ++this.count % 10; // trace lenght
            this.trace[current]= this.CreateCircle (2);
            // clear old trace point if needed
            if (this.trace[next]) this.map.removeLayer (this.trace[next]);  
        }
    }
    
    var info= "Nom=<b>" + this.name + "</b> mmsi=<b>" + this.devid + "</b> " +
              "<br>Pos:<b>" + this.lat.toFixed(4) + "</b>,<b>" + this.lon.toFixed(4)  +
              "</b> Sog:<b>" + this.sog.toFixed(2)+ "</b> Cog<b>:"+ this.cog.toFixed(2) + "</b>" +
              "<br>LastShow=<b>" + this.LastShow() + "</b> ";

    this.marker.bindPopup("<center>"+info+"</center>");

    this.CreateVector();
};
    
DeviceOnMap.prototype.UpdateInfo= function(data) {

    // if AIS authent arrive after 1st position let's refresh VesselMaker
    if (!this.name && data.name) {
        if (this.marker) this.map.removeLayer (this.marker);
        this.name= data.name;
        this.CreateMarker(true);
    }
};

DeviceOnMap.prototype.DevicePing= function(data) {

    // if device was inactive change it status
    if (!this.active) {
        if (this.marker) this.map.removeLayer (this.marker);
        this.CreateMarker(true);
    }
    this.lastshow = new Date().getTime();
};
    
DeviceOnMap.prototype.SetInactive=function () {
    if (this.vector) this.map.removeLayer (this.vector);
    for (var slot in this.trace) {
        if (!this.trace [slot]) this.map.removeLayer(this.trace [slot]);
    }
    if (this.marker) this.map.removeLayer (this.marker);
    this.CreateMarker(false);
};

DeviceOnMap.prototype.RemoveTarget=function (scope) {
    if (this.marker) this.map.removeLayer (this.marker);
    for (var slot in this.trace) {
        if (!this.trace[slot]) this.map.removeLayer(this.trace [slot]);
    }
    delete scope.activeVessels [this.devid];
};

                                    


function AisWebsock (uri, callback) {

    var restart = function () {
       console.log ("AisWebsock will retry %s in 10s", uri); 
       setTimeout (openws, 10000);
    };
    
    var openws = function () {

        var ws = new WebSocket(uri);
        if (!ws)  {
            console.log ("AisWebsock Open %s fail", uri);
            restart();
            return;
        } else console.log ("AisWebsock done ", uri); 

        ws.onmessage = function (event) {
            callback (event.data);
        };

        ws.onerror = function (event) {
            console.log ("AisWebsock Closing %s", uri);
            restart();
        };
    };
    
    openws();     // init webscocket

}

    angular.module('AisToMap', [])
            .directive('aisToMap', function ($location, $timeout, urlquery) {
                
                function mymethods(scope, elem, attrs) {
                    scope.activeVessels=[];
                    
                    // process AIS position returned by websocket
                    scope.DisplayCallback = function (message) {
                        //console.log ('data=%s', message);
                        var data= JSON.parse (message);  

                        switch (data.type) {
                            case 0: // initial messages get both auth & position info
                               scope.activeVessels [data.devid]= new DeviceOnMap (scope.map, data);
                               scope.activeVessels [data.devid].UpdateInfo(data);
                               scope.activeVessels [data.devid].UpdatePos (data);
                               break;

                            case 1: // authentication 
                                if (!scope.activeVessels[data.devid]) scope.activeVessels [data.devid]= new DeviceOnMap (scope.map, data);
                                scope.activeVessels [data.devid].UpdateInfo (data);
                                break;

                            case 2: // position update
                                if (!scope.activeVessels[data.devid]) scope.activeVessels [data.devid]= new DeviceOnMap (scope.map, data);
                                scope.activeVessels [data.devid].UpdatePos (data);
                                break;
                                
                            case 3: // device ping
                                if (scope.activeVessels[data.devid]) scope.activeVessels[data.devid].DevicePing(data);
                                break;

                            case 4: // data quit let's clean the place
                                if (!scope.activeVessels [data.devid]) {
                                    scope.activeVessels [data.devid].RemoveTarget(scope);
                                }
                                break;
                            default:
                               console.log ("HOOP: unknown message type: %s [%s]", data.type, JSON.stringify(data));
                        }                        
                    };
                    
                    scope.CleanOldPos = function () {
                        var timeout1 = new Date().getTime() - (scope.inactivity*1000);
                        var timeout2 = new Date().getTime() - (scope.inactivity*2000);
                        for (var devid in scope.activeVessels) {
                            var vessel = scope.activeVessels[devid];
                            if (vessel.lastshow < timeout2) vessel.RemoveTarget(scope);
                            else if (vessel.lastshow < timeout1) vessel.SetInactive();
                        }
                        // Check for inactive vessels every 30s
                        $timeout (scope.CleanOldPos, scope.inactivity*250);                        
                    }; 
                    
                    scope.StartTracking= function() {
                        // open websocket on sinagot.net localtraffic + Mobile + Tracker
                        new AisWebsock ("ws://" + $location.host() + "/ais-droid?API_KEY=123456789", scope.DisplayCallback);
                        
                        // start process to clean old position
                        scope.CleanOldPos();
                    };
                    
                    scope.Init = function() {
                        
                        scope.map = L.map(attrs.id,  {"keyboardZoomOffset": 0.05, maxZoom: 20, "scrollWheelZoom": true });
                        
                        // Default Morbihan (South Britanny)
                        scope.lat=urlquery.lat   || 48.123;
                        scope.lng=urlquery.lng   || -3.05;
                        scope.zoom=urlquery.zoom || 9;
                        
                        scope.minzoom=attrs.minzoom || 0;
                        scope.maxzoom=attrs.maxzoom || 12;
                        
                        scope.inactivity=attrs.inactivity || 1000; // time before moving target to inactive
                         
                        // Warning: to use Tangram vector layer
                        //  - need to force load of tangram.min.js not concatenated with any other JS files
                        //  - load tangram.min.js with Index.htlm template and not through gulp
                        //var tangramLayer = Tangram.leafletLayer({
                        //    workerUrl: 'http://sinagot.prod/aisweb',
                        //    scene: 'config/LeafletMap.yaml',
                        //    attribution: '<a href="https://mapzen.com/tangram" target="_blank">Mapzen</a>'
                        //}).addTo (scope.map);
                        
                        var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                        var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a>';
                        var osm = new L.TileLayer(osmUrl, {attribution: osmAttrib}).addTo (scope.map);	

                        // References http://wiki.openseamap.org/wiki/OpenSeaMap_in_Website
                        var OpenSeaMap = L.tileLayer (
                            'http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
                            {attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> <b>aisweb</b> by <a href="http://sinagot.net">sinagot.net</a>'}
                        ).addTo (scope.map);
                				
                        // center the map
                        scope.map.setView ([scope.lat, scope.lng], scope.zoom);

                        $timeout (scope.StartTracking, 125);
                        
                        // add listener on mouse move
                        scope.map.getContainer().addEventListener('mouseup', function (event) {
                            var latlng = scope.map.getCenter();
                            scope.lat = latlng.lat;
                            scope.lng = latlng.lng;
                            
                            $location.search({lat:scope.lat, lng:scope.lng, zoom: scope.zoom});
                            scope.$apply();
                        });
                        scope.map.getContainer().addEventListener('mousewheel', function (event) {
                            scope.zoom = scope.map.getZoom();
                            $location.search({lat:scope.lat, lng:scope.lng, zoom: scope.zoom});
                            scope.$apply();                          
                        });                        
                    };

                    scope.Init ();

                }

                return {
                    restrict: 'E',
                    template: tmpl,
                    link: mymethods,
                    scope: {}
                };
            });
})();
