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
} 
  
DeviceOnMap.prototype.CreateCircle= function (radius) {
    var marker= L.circleMarker([this.lat, this.lon],  {
        radius: radius,
        color:  'purple',
        weight:  0.5,
        opacity: 0.5,
        riseOnHover: true,
        fillOpacity: 0.5
      }).addTo(this.map);
    var info= "devid="+this.devid +" name=" +this.name+"<br>lat:"+this.lat.toFixed(4) +" lon:" +this.lon.toFixed(4) +
              " spd:" + this.sog.toFixed(2)+ " hdg:"+ this.cog.toFixed(2)+"<br>" +  new Date();
    marker.bindPopup("<center>"+info+"</center>");
    return (marker);
};

    // Create a marker from device object and plate in on the map
DeviceOnMap.prototype.CreateMarker= function () {
    if (!this.lat || !this.lon) return;

    this.marker= L.marker([this.lat, this.lon],  
        { 
           icon : L.divIcon({className:'vessel-' + this.src, iconSize:[10,10]}),
           clickable: true,
           title: 'Nom=' + this.name + ' ['+ this.devid+ ']'
        }).addTo(this.map);

    var info="devid=" +this.devid+"<br>Name=" + this.name +"</b><img src="+this.img+" width='250' >";  
    this.marker.bindPopup("<center>"+info+"</center>");
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
                {clickable:false, className: "vector-" + this.src, opacity:0.7, dashArray:[3, 10]}).addTo(this.map);
       
};
    
// if no marker create on, else move it and update trace
DeviceOnMap.prototype.UpdatePos = function (data) {
    
    // no valid position just ignore
    if (!data.lat || !data.lon) return;
    this.lat = data.lat;
    this.lon = data.lon;
    this.sog = data.sog || 0;
    this.cog = data.cog || 0;

    if (!this.marker) this.CreateMarker();
    else {
        // move data marker to new location
        this.marker.setLatLng ([this.lat, this.lon]);
        // add a new point to trace
        var current= this.count; 
        var next   = ++this.count % 10;
        this.trace[current]= this.CreateCircle (2);
        // clear old trace point if needed
        if (this.trace[next]) this.map.removeLayer (this.trace[next]);  
    }
    
    var info= "devid=<b>" + data.devid + "</b> Nom=<b>" + this.name + "</b>" +
              "<br>pos:<b>" + this.lat.toFixed(4) + "</b>,<b>" + this.lon.toFixed(4)  +
              "<br></b> sog:<b>" + this.sog.toFixed(2)+ "</b> hdg<b>:"+ this.cog.toFixed(2) + "</b>";

    this.marker.bindPopup("<center>"+info+"</center>");

    this.CreateVector();
};
    
DeviceOnMap.prototype.UpdateInfo= function(data) {

    // if AIS authent arrive after 1st position let's refresh VesselMaker
    if (!this.name && data.name) {
        console.log ("UpdateInfo refresh Maker");
        if (this.marker) this.map.removeLayer (this.marker);
        this.name= data.name;
        this.CreateMarker();
    }
};
    
DeviceOnMap.prototype.CleanTrace=function () {
    for (var slot in this.trace) {
        if (this.trace [slot] !== undefined) {
            this.map.removeLayer(this.trace [slot]);
        }
    }
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
            .directive('aisToMap', function ($location, urlquery) {
                
                function mymethods(scope, elem, attrs) {
                    scope.activeDevs=[];
                    
                    // process AIS position returned by websocket
                    scope.DisplayCallback = function (message) {
                        //console.log ('data=%s', message);
                        var data= JSON.parse (message);  

                        switch (data.type) {
                            case 0: // initial messages get both auth & position info
                               scope.activeDevs [data.devid]= new DeviceOnMap (scope.map, data);
                               scope.activeDevs [data.devid].UpdateInfo(data);
                               scope.activeDevs [data.devid].UpdatePos (data);
                               break;

                            case 1: // authentication 
                                if (!scope.activeDevs[data.devid]) scope.activeDevs [data.devid]= new DeviceOnMap (scope.map, data);
                                scope.activeDevs [data.devid].UpdateInfo (data);
                                break;

                            case 2: // position update
                                if (!scope.activeDevs[data.devid]) scope.activeDevs [data.devid]= new DeviceOnMap (scope.map, data);
                                scope.activeDevs [data.devid].UpdatePos (data);
                                break;

                            case 3: // data quit let's clean the place
                                if (scope.activeDevs [data.devid] !== undefined) {
                                    scope.activeDevs [data.devid].CleanTrace();
                                    delete scope.activeDevs [data.devid];
                                }
                                break;
                            default:
                               console.log ("HOOP: unknown message type: %s [%s]", data.type, JSON.stringify(data));
                        }
                    };
                    
                    
                    scope.Init = function() {
                        
                        scope.map = L.map(attrs.id,  {"keyboardZoomOffset": 0.05, maxZoom: 20, "scrollWheelZoom": true });
                        
                        // Default Morbihan (South Britanny)
                        scope.lat=urlquery.lat || 47.6;
                        scope.lng=urlquery.lng || -3.5;
                        scope.zoom=urlquery.zoom || 8;

                        scope.style = 'http://sinagot.prod/aisweb/config/LeafletMap.yaml'; 

                        
                        scope.tangramLayer = Tangram.leafletLayer({
                            workerUrl: 'http://sinagot.prod/aisweb',
                            scene: 'config/LeafletMap.yaml',
                            attribution: '<a href="https://mapzen.com/tangram" target="_blank">Mapzen</a>'
                        }).addTo (scope.map);
                        
                        scope.OpenSeaMap = L.tileLayer (
                            'http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
                            {attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> <b>aisweb</b> by <a href="http://sinagot.net">sinagot.net</a>'}
                        ).addTo (scope.map);

                        // Harbours
			//var layer_pois = new L.Layer.Vector("Häfen", { projection: new OpenLayers.Projection("EPSG:4326"), visibility: true, displayOutsideMaxExtent:true});
				
                        // center the map
                        scope.map.setView ([scope.lat, scope.lng], scope.zoom);
                        
                        // open 2 websockets (Trackers+Mobiles)
                        new AisWebsock ("ws://" + $location.host() + "/ais-track?API_KEY=123456789", scope.DisplayCallback);
                        new AisWebsock ("ws://" + $location.host() + "/ais-droid?API_KEY=123456789", scope.DisplayCallback);
                        
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
