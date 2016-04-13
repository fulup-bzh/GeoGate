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
 * Usage:
 * 
 *   // mouse event probably point on icon and not on button div
 *   ... ng-click="LockChannel($event)
     var target= angular.element(event.currentTarget);
     var button= JQemu.FindInParent (target, 'div');
 * 
 */


(function () {
    'use strict';


          
    // _all modules only reference dependencies
    angular.module('JQueryEmu', [])

            // Factory is a singleton and share its context within all instances.
            .factory('JQemu', function () {

                var FindInParent = function (element, selector) {
                    var parent = element;
                    var search = selector.toUpperCase();
                    while (parent[0]) {
                        if (search === parent[0].tagName) {
                            return parent;
                        }  // HTMLDivElement properties
                        parent = parent.parent();
                    }
                };
                
                var  FindByTag= function (element, tag, selector) {
                    var search = selector.toLowerCase();
                    var type   = tag.toLowerCase()+ "Name";
                    var children = element.children();
                    while (children[0]) {
                        if (search === children[0][type]) {
                            return children;
                        }  // HTMLDivElement properties
                        children = children.next();
                    }
                };
                
                var  FindByClass= function (element, selector) {
                    var search = selector.toLowerCase();
                    var children = element.children();
                    while (children[0]) {
                        if (children.hasClass(search)) {
                            return children;
                        }  // HTMLDivElement properties
                        children = children.next();
                    }
                };

                var myMethods = {
                    FindInParent: FindInParent,
                    FindByTag: FindByTag,
                    FindByClass: FindByClass
                };

                return myMethods;
            });

})();