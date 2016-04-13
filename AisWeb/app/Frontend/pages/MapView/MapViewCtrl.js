(function() {
'use strict';

// WARNING: make sure than app/frontend/services/AppConfig.js match your server

// list all rependencies within the page + controler if needed
angular.module('MapViewModule', ['AisToMap'])

  .controller('MapViewController', function (AppCall, Notification) {
        var scope = this; // I hate JavaScript
        scope.uuid   ="none";
         
        scope.AppliCB = function(appliID, action, response) {
                // Action is done within Widget Controller only update debug UI zone
                scope.request  = action; 
                scope.errcode  = response.status;
                if (response.data) scope.response = response.data;
                
                // On app was removed let's update runnable list
                if (action === "uninstall")  scope.GetRunnables();
        };
        
        // startup the application
           
   });

console.log ("MapView Controller Loaded");
})(); 