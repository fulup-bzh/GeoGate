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
 * Bugs: Input with Callback SHOULD BE get 'required' class
 */

(function () {
    'use strict';

    var tmplAppli = '<div  ng-click="clicked()">' +
            '<img ng-src="{{icon}}">' +
            '<span>{{label}}</span>' +
            '</div>';
    
    var tmplModal = 
            '<b class="close-button" ng-click="close()">×</b>' +
            '<img ng-src="{{icon}}">' +
            '<span class="modal-text">Application <b>{{label}}</b></span>' +
            '<ul class="vertical icon-left primary menu-bar appli-menu-start">' +
            '<li class=start-{{runstatus}}><a ng-click=action("start")><i class="fi-check"> Start</i></a></li>' +
            '<li class=stop-{{runstatus}}><a ng-click=action("stop")><i class="fi-x"> Stop</i></a></li>' +
            '<li><a ng-click=action("info")><i class="fi-info"> Info</i></a></li>' +
            '<li class=start-{{runstatus}}><a ng-click=action("uninstall")><i class="fi-x"> Uninstall</i></a></li>' +
            '</ul>' +
            '';
    
    var tmplDetail = 
            '<b class="close-button" ng-click="close()">×</b>' +
            '<img ng-src="{{icon}}">' +
            '<span class="modal-text">Application <b>{{label}}</b></span>' +
            '<ul class="vertical icon-left appli-menu-info">' +
            '<li><i class="fi-paperclip"> Name : {{detail.name}} </i></li>' +
            '<li><i class="fi-info"> Description {{detail.description}}</i></li>' +
            '<li><i class="fi-torso"> Author : {{detail.author}}</i></li>' +
            '</ul>' +
            '';

    angular.module('AppliButton', [])
            .directive('appliButton', function (AppConfig, AppCall, ModalFactory, Notification, $timeout, $window, $location, urlquery) {

                function mymethods(scope, elem, attrs) {
                    scope.runstatus = "stop";
                    scope.runmode   = urlquery.runmode || "auto";
                    scope.clicked = function () {

                        var notifyError = function(action, response) {
                            Notification.error ({message: "Fail /api/afm-main" + action + "=" + scope.label + " RunID="+ scope.appID, delay: 5000});
                            elem.addClass ("fail");
                            elem.removeClass ("success");
                            scope.callback (scope.appID, action, response);
                        };
                        
                        var notifySuccess = function (action, response) {
                            elem.removeClass ("fail");
                            scope.runID = response.data.response.runid;
                            scope.callback (scope.appID, action, response);
                        };
                        
                        var closeModApp = function() {
                            scope.modApp.deactivate();
                            $timeout (function() {scope.modApp.destroy();}, 1000);
                        };
                        
                        var closeModInfo = function() {
                            scope.modInfo.deactivate();
                            $timeout (function() {scope.modInfo.destroy();}, 1000);
                        };
                        
                        var actionModal = function(action) {
                            console.log ("Modal Action=%s", action);
                            switch (action) {
                                
                                case "start":
                                    if (scope.runstatus !== "stop") return;
                                    AppCall.get ("afm-main", "start", {id: scope.appID, mode: scope.runmode}, function(response) {
                                        if (response.status !== 200 || response.data.jtype !== "AJB_reply") {
                                            notifyError ("start", response);
                                            return;
                                        }
                                        scope.runstatus="start";
                                        notifySuccess (action, response);
					if(response.data.response.uri)
                                            scope.winapp= $window.open(response.data.response.uri.replace("%h", $location.host()));                                            
                                    });
                                    break;
                                    
                                case "stop":
                                    if (scope.runstatus !== "start") return;
                                    
                                    AppCall.get ("afm-main", "terminate", {runid: scope.runID}, function(response) {
                                        if (response.status !== 200 || response.data.jtype !== "AJB_reply") {
                                            notifyError ("stop", response);
                                            return;
                                        }
                                        scope.runstatus="stop";
                                        
                                        // if a remote window app was open let's close it
                                        if (scope.winapp) {
                                           console.log ("Closing Application Window label=%s id=%s", scope.label, scope.appID);
                                           scope.winapp.close();
                                           scope.winapp=false;
                                        }
                                        notifySuccess (action, response);
                                    });
                                    break;
                                        
                                case "info":
                                    AppCall.get ("afm-main", "detail", {id: scope.appID}, function(response) {
                                        if (response.status !== 200 || response.data.jtype !== "AJB_reply") {
                                            notifyError ("detail", response);
                                            return;
                                        }
                                                                               
                                        // reference http://foundation.zurb.com/apps/docs/#!/angular-modules
                                        var config = {
                                            animationIn: 'slideInFromTop',
                                            contentScope: {
                                                close   : closeModInfo,
                                                icon    : scope.icon,
                                                label   : scope.appID,
                                                detail  : response.data.response
                                            }, template : tmplDetail
                                        }; 
                                        // Popup Modal to render application data
                                        scope.modInfo = new ModalFactory(config);
                                        scope.modInfo.activate ();

                                    });
                                    break;

                                case "uninstall":
                                    if (scope.runstatus !== "stop") return;
                                    AppCall.get ("afm-main", "uninstall", {id: scope.appID}, function(response) {
                                        if (response.status !== 200 || response.data.jtype !== "AJB_reply") {
                                            notifyError ("uninstall", response);
                                            return;
                                        }
                                        
                                        notifySuccess (action, response);
                                    });
                                    break;

                                default:
                                    console.log ("ActionModal unknown action=[%s]", action);
                                    break;
                            }
                            
                            closeModApp();
                        };
            
                        // reference http://foundation.zurb.com/apps/docs/#!/angular-modules
                        var config = {
                            animationIn: 'slideInFromTop',
                            contentScope: {
                                action   : actionModal,
                                runstatus: scope.runstatus,
                                close    : closeModApp,
                                icon     : scope.icon,
                                label    : scope.label
                            }, template  : tmplModal
                        }; 
                        // Popup Modal to render application data
                        scope.modApp = new ModalFactory(config);
                        scope.modApp.activate ();
                    };

                    // extract application information from AppID+Store
                    if (attrs.handle && scope.store [attrs.handle].name) {
                        scope.icon  = AppConfig.paths.icons + attrs.handle; //scope.store [attrs.handle].name.toLowerCase() + '-ico.png';
                        scope.label = scope.store [attrs.handle].name;
                        scope.appID= attrs.handle;
                    } else {
                         scope.icon  = AppConfig.paths.icons + 'w3c-ico.png';
                         scope.label = attrs.handle;
                    }
                                
                    // add label as class
                    elem.addClass (scope.label.toLowerCase());
                    
                    // note: clicked in imported and when template is clicked
                    // it will call clicked method passed in param.
                }
                
                return {
                    restrict: 'E',
                    template: tmplAppli,
                    link: mymethods,
                    scope: {callback: '=', store: '='}
                };
            });
})();
