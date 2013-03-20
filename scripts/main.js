(function($, undefined) {

    var container = $("#map"),
        paper = window.demo.initializer.initMap();

    // instantiate panZoom
    var panZoom = paper.panzoom({ 
        initialZoom: 2,
        gestures: true,
        initialPosition: { 
            x: 120, 
            y: 70
        }
    });

    panZoom.enable();

    // attach click handlers for map controls
    // move commands are custom commands i added to raphael.pan-zoom.js
    $("#mapContainer #in").click(function (e) {
        e.preventDefault();
        panZoom.zoomIn(1);
    });

    $("#mapContainer #out").click(function (e) {
        e.preventDefault();
        panZoom.zoomOut(1);
    });

    $("#mapContainer #left").click(function (e) {
        e.preventDefault();
        panZoom.moveLeft(100);
    });

    $("#mapContainer #right").click(function (e) {
        e.preventDefault();
        panZoom.moveRight(100);
    });

    $("#mapContainer #up").click(function (e) {
        e.preventDefault();
        panZoom.moveUp(100);
    });

    $("#mapContainer #down").click(function (e) {
        e.preventDefault();
        panZoom.moveDown(100);
    });

})(jQuery);