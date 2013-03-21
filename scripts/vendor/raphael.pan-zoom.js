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
                'transform_always_block': true,
                'drag_max_touches': 1,
                'drag_lock_to_axis': false
            });

            var initialZoom, initialPercentZoom, previousZoom, previousCenter, firstPinch;

            hammer.on("touch", function(event) {
                initialZoom = me.currZoom;
                initialPercentZoom = 1 / (1 - (initialZoom * settings.zoomStep));
                previousZoom = me.currZoom;
                previousCenter = event.gesture.center;
                firstPinch = true;
            });

            hammer.on("release", function(event) {
            });

/*
            var $pointer = $('<div style="width: 2px; height: 2px; position: absolute; overflow: hidden; display: box; left: 10px; top: 10px; background-color: red;"></div>');
            $('body').append($pointer);

            var $pointer2 = $('<div style="width: 2px; height: 2px; position: absolute; overflow: hidden; display: box; left: 10px; top: 10px; background-color: blue;"></div>');
            $('body').append($pointer2);
*/

            var pinching = function(event) {
                var g = event.gesture,
                    newPercentZoom = initialPercentZoom * g.scale,
                    newZoom = - (( 1 / newPercentZoom -1) / settings.zoomStep),
                    steps = newZoom - previousZoom;

                if (steps !== 0) {
                    applyZoom(steps, getRelativePosition(g.center, container));
                    previousZoom = newZoom;
                }

                firstPinch = false;
            };

            var panning = function(event, pinching) {
                if (pinching === "undefined") {
                    pinching = false;
                }

                var g = event.gesture,
                    center = g.center,
                    stepsX = center.pageX - previousCenter.pageX,
                    stepsY = center.pageY - previousCenter.pageY;

                if ((!pinching || !firstPinch) && (pinching || firstPinch)) {

                    move(stepsX, stepsY);

/*
                    $pointer2.css({
                        'left': previousCenter.pageX + 'px',
                        'top': previousCenter.pageY + 'px'
                    });

                    $pointer.css({
                        'left': center.pageX + 'px',
                        'top': center.pageY + 'px'
                    });
*/
                }
                previousCenter = center;
            };

            hammer.on("pinchin", function(event) {
                panning(event, true);
                pinching(event);
            });

            hammer.on("pinchout", function(event) {
                panning(event, true);
                pinching(event);
            });

            hammer.on("drag", panning);
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
            var previousZoom = me.currZoom;

            me.currZoom += val;
            if (me.currZoom < settings.minZoom) { 
                me.currZoom = settings.minZoom;
            } else if (me.currZoom > settings.maxZoom) {
                me.currZoom = settings.maxZoom;
            }

            // correct the added value.
            val = me.currZoom - previousZoom;
             
            // if no centerPoint is given ... the center point is at the center of the paper.
            // the centerPoint is a point given on the original paper width.
            centerPoint = centerPoint || { x: paper.width/2, y: paper.height/2 };

            // still needs an explanation .. don't know how this works ... but it works :)
            deltaX = ((paper.width * settings.zoomStep) * (centerPoint.x / paper.width)) * val;
            deltaY = ((paper.height * settings.zoomStep) * (centerPoint.y / paper.height)) * val;

            repaint();
        }

        this.applyZoom = applyZoom;

        function dragging(e) {
            if (!me.enabled) return false;
            var evt = window.event || e,
                newPoint = getRelativePosition(evt, container);

            updatePos(newPoint);

            repaint();
            me.dragTime++;
            if (evt.preventDefault) evt.preventDefault();
            else evt.returnValue = false;
            return false;
        }

        /**
         * Move the viewBox for x number of pixels on the x-axis and y number of pixels on the y-axis
         */
        function move(x, y) {
            updatePos({
                'x': initialPos.x + (x),
                'y': initialPos.y + (y)
            });

            repaint();
        }

        this.move = move;

        function updatePos(newPoint) {
             // calculate the new width and height ... this is the width/height of what the viewbox will show.
             // the smaller the width/height, the higher the zoom level (the higher the zoomLevel, the less there is shown in the viewBox)
            var zoomPercentage = (1 - (me.currZoom * settings.zoomStep)),
                newWidth = paper.width * zoomPercentage,
                newHeight = paper.height * zoomPercentage;

            // newPoint and initialPos are points based on the current paper
            // we need points on the original paper ... when zooming you get more pixels for one pixel on the real paper!
            // for example original viewbox = 800, the new viewbox = 400 but the viewbox of 400 is still shown in the original paper (800)
            // so every original pixel of the paper is now 2 pixels in the new viewbox. When you want to calculate the distance between the two points
            // newPoint and initialPos by doing newPoint - initialPos then you get the distance in regard to the original paper (800) while the viewbox = 600
            // to get the distance to the current viewbox you need to current pixels / width original paper * width current viewbox.
            // + viewbox of 800 in a paper of 800 => 1px current viewbox = 1px original paper
            // + viewbox of 400 in a paper of 800 => 2px current viewbox = 1px original paper
            deltaX = (newWidth * (newPoint.x - initialPos.x) / paper.width) * -1;
            deltaY = (newHeight * (newPoint.y - initialPos.y) / paper.height) * -1;
            initialPos = newPoint;
        }

        function repaint() {
            // me.currPos is the x, y point of the viewBox, based on 100% view of the paper ... we need to add the delta to it.
            // if there is a delta then the viewBox is moved.
            me.currPos.x = me.currPos.x + deltaX;
            me.currPos.y = me.currPos.y + deltaY;

            var currZoom = (me.currZoom * settings.zoomStep) >= 1 ? me.currZoom -1 : me.currZoom, // make sure we don't zoom to far
                zoomPercentage = (1 - (currZoom * settings.zoomStep)), // the zooming percentage
                newWidth = paper.width * zoomPercentage, // this is the new width of what's shown in the viewbox ... this get's smaller when you have a higher zoomLevel (the higher the zoomLevel, the less there is shown in the viewBox)
                newHeight = paper.height * zoomPercentage; // this is the new height of what's shown in the viewbox ... this get's smaller when you have a higher zoomLevel (the higher the zoomLevel, the less there is shown in the viewBox)

            // make sure you don't pan too far
            if (me.currPos.x < 0) me.currPos.x = 0;
            else if (me.currPos.x > paper.width - newWidth) { // paper.width is not allways the same to the real width and height of the svg ... maybe at custom boundaries?
                me.currPos.x = paper.width - newWidth;
            }

            if (me.currPos.y < 0) me.currPos.y = 0;
            else if (me.currPos.y > paper.height - newHeight) {
                me.currPos.y = paper.height - newHeight;
            }

            paper.setViewBox(me.currPos.x, me.currPos.y, newWidth, newHeight);
            settings.onRepaint();
        }
    };

    PanZoom.prototype = panZoomFunctions;

    function getRelativePosition(e, obj) {
        var x, y, pos;
        if (e.pageX || e.pageY) {
            x = e.pageX;
            y = e.pageY;
        } else {
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