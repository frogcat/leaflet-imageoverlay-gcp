(function() {

  L.ImageOverlay.GCP = L.Layer.extend({
    options: {
      opacity: 1.0,
      interactive: true
    },
    initialize: function(url, groundControlPoints, options) {
      this.setUrl(url);
      this.setGroundControlPoints(groundControlPoints);
      L.Util.setOptions(this, options);
    },
    setOpacity: function(opacity) {
      if (this._canvas) {
        this.options.opacity = Math.min(1.0, Math.max(0.0, opacity));
        L.DomUtil.setOpacity(this._canvas, this.options.opacity);
      }
    },
    setGroundControlPoints: function(groundControlPoints) {
      this.groundControlPoints = groundControlPoints;
      this.paint();
    },
    setUrl: function(url) {
      var that = this;
      delete that._image;
      var image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = function() {
        that._image = image;
        that._resize();
      };
      image.src = url;
    },
    getEvents: function() {
      return {
        zoom: this.paint,
        viewreset: this.paint,
        moveend: this.paint,
        resize: this._resize
      };
    },
    onAdd: function(map) {
      this._canvas = document.createElement("canvas");
      this.setOpacity(this.options.opacity);
      this._context = this._canvas.getContext("morph");
      this.getPane().appendChild(this._canvas);
      if (this.options.interactive) {
        L.DomUtil.addClass(this._canvas, 'leaflet-interactive');
        this.addInteractiveTarget(this._canvas);
      }
      this._resize();
    },
    onRemove: function(map) {
      L.DomUtil.remove(this._canvas);
      if (this.options.interactive) {
        this.removeInteractiveTarget(this._canvas);
      }
    },
    _resize: function() {
      if (this._map && this._canvas) {
        var s = this._map.getSize();
        this._canvas.width = s.x;
        this._canvas.height = s.y;
        this._canvas.style.width = s.x + "px";
        this._canvas.style.height = s.y + "px";
        this.paint();
      }
    },
    paint: function() {
      if (!this._map || !this._canvas || !this._context || !this._image) return;
      var canvas = this._canvas;
      var context = this._context;
      var image = this._image;
      var map = this._map;
      var groundControlPoints = this.groundControlPoints;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      context.clear();
      context.drawImage(image, groundControlPoints.map(function(a) {
        var p = a.imagePoint;
        var q = map.latLngToContainerPoint(a.latlng);
        return [p.x, p.y, q.x, q.y];
      }));
    },
    containerPointToImagePoint: function(containerPoint) {
      if (this._context) {
        var xy = this._context.getTexturePointAt(containerPoint.x, containerPoint.y);
        if (xy) return L.point(xy[0], xy[1]);
      }
      return null;
    }
  });

  L.imageOverlay.gcp = function(url, groundControlPoints, options) {
    return new L.ImageOverlay.GCP(url, groundControlPoints, options);
  };

})();
