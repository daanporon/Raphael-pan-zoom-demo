// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
 
// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel
 
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());


/**
 * raphael.pan-zoom plugin 0.2.0
 * Copyright (c) 2012 @author Juan S. Escobar
 * https://github.com/escobar5
 *
 * licensed under the MIT license
 */
(function () {

    Raphael.fn.panzoom = {};

    Raphael.fn.panzoom = function (options) {
        var paper = this;
        return new PanZoom(paper, options);
    };

    var panZoomFunctions = {
        enable: function () {
            this.enabled = true;
        },

        disable: function () {
            this.enabled = false;
        },

        zoomIn: function (steps) {
            this.applyZoom(steps);
        },

        zoomOut: function (steps) {
            this.applyZoom(steps > 0 ? steps * -1 : steps);
        },

        // ADDED: custom commands i added!
        moveLeft: function (steps) {
            this.move(steps, 0);
        },

        moveRight: function (steps) {
            this.move(- steps, 0);
        },

        moveUp: function (steps) {
            this.move(0, steps);
        },

        moveDown: function (steps) {
            this.move(0, - steps);
        },

        pan: function (deltaX, deltaY) {
        },

        isDragging: function () {
            return this.dragTime > this.dragThreshold;
        },

        getCurrentPosition: function () {
            return this.currPos;
        },

        getCurrentZoom: function () {
            return this.currZoom;
        }
    },

    PanZoom = function (el, options) {
        var paper = el,
            container = paper.canvas.parentNode,
            me = this,
            settings = {},
            initialPos = { x: 0, y: 0 },
            deltaX = 0,
            deltaY = 0,
            mousewheelevt = (/Firefox/i.test(navigator.userAgent)) ? "DOMMouseScroll" : "mousewheel";

        this.enabled = false;
        this.dragThreshold = 5;
        this.dragTime = 0;

        options = options || {};

        settings.zoomStep = options.zoomStep || 0.1;
        settings.maxZoom = options.maxZoom || (1 / settings.zoomStep)%1 <= 0 ? (1 / settings.zoomStep) - 1 : (1 / settings.zoomStep);
        settings.minZoom = options.minZoom || 0;
        settings.initialZoom = options.initialZoom || 0;
        settings.initialPosition = options.initialPosition || { x: 0, y: 0 };
        settings.onRepaint = options.onRepaint || function() {}; // ADDED: make it possible to define a onRepaint callback
        settings.gestures = options.gestures || false;

        this.currZoom = settings.initialZoom;
        this.currPos = settings.initialPosition;
        this.zoomStep = settings.zoomStep // ADDED: add a public zoomStep property to the PanZoom object

        repaint();

        if (settings.gestures && typeof Hammer === "function") {
            var hammer = Hammer(container, {
                'transform_min_scale': settings.zoomStep,
                'drag_block_horizontal': true,
                'drag_block_vertical': true,
                'transform_always_block': true
            });

            var initialZoom, previousZoom, previousCenter;

            hammer.on("touch", function(event) {
                initialZoom = me.currZoom;
                previousZoom = me.currZoom;
                previousCenter = event.gesture.center;
            });

            hammer.on("release", function(event) {
            });

            var pinching = function(event) {
                var g = event.gesture,
                    newZoom = initialZoom * g.scale,
                    steps = newZoom - previousZoom;

                if (steps !== 0) {
                    applyZoom(steps, getRelativePosition(g.center, container));
                    previousZoom = newZoom;
                }
            };

            var panning = function(event) {
                var g = event.gesture,
                    center = g.center,
                    stepsX = center.pageX - previousCenter.pageX,
                    stepsY = center.pageY - previousCenter.pageY;

                move(stepsX, stepsY);
                previousCenter = center;
            };

            hammer.on("pinchin", function(event) {
                pinching(event);
                panning(event);
            });

            hammer.on("pinchout", function(event) {
                pinching(event);
                panning(event);
            });

            hammer.on("dragup", panning);
            hammer.on("dragdown", panning);
            hammer.on("dragleft", panning);
            hammer.on("dragright", panning);
        }

        container.onmousedown = function (e) {
            var evt = window.event || e;
            if (!me.enabled) return false;
            me.dragTime = 0;
            initialPos = getRelativePosition(evt, container);
            container.className += " grabbing";
            container.onmousemove = dragging;
            document.onmousemove = function () { return false; };
            if (evt.preventDefault) evt.preventDefault();
            else evt.returnValue = false;
            return false;
        };

        container.onmouseup = function (e) {
            //Remove class framework independent
            document.onmousemove = null;
            container.className = container.className.replace(/(?:^|\s)grabbing(?!\S)/g, '');
            container.onmousemove = null;
        };

        container.onmouseout = container.onmouseup; // ADDED: cancel dragging when leaving the container

        if (container.attachEvent) //if IE (and Opera depending on user setting)
            container.attachEvent("on" + mousewheelevt, handleScroll);
        else if (container.addEventListener) //WC3 browsers
            container.addEventListener(mousewheelevt, handleScroll, false);

        function handleScroll(e) {
            if (!me.enabled) return false;
            var evt = window.event || e,
                delta = evt.detail ? evt.detail : evt.wheelDelta * -1,
                zoomCenter = getRelativePosition(evt, container);

            if (delta > 0) delta = -1;
            else if (delta < 0) delta = 1;
            
            applyZoom(delta, zoomCenter);
            if (evt.preventDefault) evt.preventDefault();
            else evt.returnValue = false;
            return false;
        }

        function applyZoom(val, centerPoint) {
            if (!me.enabled) return false;
            me.currZoom += val;
            if (me.currZoom < settings.minZoom) me.currZoom = settings.minZoom;
            else if (me.currZoom > settings.maxZoom) me.currZoom = settings.maxZoom;
            else {
                centerPoint = centerPoint || { x: paper.width/2, y: paper.height/2 };

                deltaX = ((paper.width * settings.zoomStep) * (centerPoint.x / paper.width)) * val;
                deltaY = (paper.height * settings.zoomStep) * (centerPoint.y / paper.height) * val;

                repaint();
            }
        }

        this.applyZoom = applyZoom;

        function dragging(e) {
            if (!me.enabled) return false;
            var evt = window.event || e,
                newPoint = getRelativePosition(evt, container);

            updatePos(newPoint);  // ADDED: Refactored into a separate method to make it reusable       

            repaint();
            me.dragTime++;
            if (evt.preventDefault) evt.preventDefault();
            else evt.returnValue = false;
            return false;
        }

        // ADDED: make it possible to move to a certain possition ... this will add a few pixels on the x or y axis
        function move(x, y) {
            updatePos({
                'x': initialPos.x + (x),
                'y': initialPos.y + (y)
            });

            repaint();
        }

        this.move = move;

        // ADDED: refactored method to make it reusable
        function updatePos(newPoint) {
            var newWidth = paper.width * (1 - (me.currZoom * settings.zoomStep)),
                newHeight = paper.height * (1 - (me.currZoom * settings.zoomStep));

            deltaX = (newWidth * (newPoint.x - initialPos.x) / paper.width) * -1;
            deltaY = (newHeight * (newPoint.y - initialPos.y) / paper.height) * -1;
            initialPos = newPoint;
        }

        function repaint() {
            window.requestAnimationFrame(function() {
                me.currPos.x = me.currPos.x + deltaX;
                me.currPos.y = me.currPos.y + deltaY;

                // ADDED: make sure we don't zoom to far !!
                var currZoom = (me.currZoom * settings.zoomStep) >= 1 ? me.currZoom -1 : me.currZoom,
                    zoomPercentage = (1 - (currZoom * settings.zoomStep)),
                    newWidth = paper.width * zoomPercentage,
                    newHeight = paper.height * zoomPercentage;

                // make sure you don't pan too far
                if (me.currPos.x < 0) me.currPos.x = 0;
                else if (me.currPos.x > (paper.width - newWidth)) { // ADDED changed the if statement
                    me.currPos.x = paper.width - newWidth;
                }

                if (me.currPos.y < 0) me.currPos.y = 0;
                else if (me.currPos.y > (paper.height - newHeight)) { // ADDED changed the if statement
                    me.currPos.y = paper.height - newHeight;
                }

                paper.setViewBox(me.currPos.x, me.currPos.y, newWidth, newHeight);
                settings.onRepaint(); // ADDED call the onRepaint function
            });
        }
    };

    PanZoom.prototype = panZoomFunctions;

    function getRelativePosition(e, obj) {
        var x,y, pos;
        if (e.pageX || e.pageY) {
            x = e.pageX;
            y = e.pageY;
        }
        else {
            x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        pos = findPos(obj);
        x -= pos[0];
        y -= pos[1];

        return { x: x, y: y };
    }

    function findPos(obj) {
        var posX = obj.offsetLeft, posY = obj.offsetTop, posArray;
        while (obj.offsetParent) {
            if (obj == document.getElementsByTagName('body')[0]) { break; }
            else {
                posX = posX + obj.offsetParent.offsetLeft;
                posY = posY + obj.offsetParent.offsetTop;
                obj = obj.offsetParent;
            }
        }
        posArray = [posX, posY];
        return posArray;
    }

})();