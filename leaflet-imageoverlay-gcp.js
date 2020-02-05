export default function(L) {

  L.ImageOverlay.GCP = L.Layer.extend({
    options: {
      opacity: 1.0,
      interactive: true
    },
    initialize: function(url, groundControlPoints, options) {
      this._url = url;
      this._groundControlPoints = groundControlPoints;
      L.Util.setOptions(this, options);
    },
    setOpacity: function(opacity) {
      this.options.opacity = opacity;
      if (this._canvas) {
        this._updateOpacity();
      }
    },
    _updateOpacity: function() {
      L.DomUtil.setOpacity(this._canvas, this.options.opacity);
    },
    setGroundControlPoints: function(groundControlPoints) {
      this._groundControlPoints = groundControlPoints;
      if (this._canvas) {
        this._reset();
      }
    },
    setUrl: function(url) {
      this._url = url;
      if (this._canvas) {
        this._initImage();
      }
    },
    _initImage: function() {
      if (this._url.tagName === 'IMG') {
        this._rawImage = this._url;
        this._url = this._rawImage.src;
        this._reset();
      } else {
        var that = this;
        delete that._image;
        var image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = function() {
          that._rawImage = image;
          that._reset();
          that.fire('load');
        };
        image.src = this._url;
      }

    },
    getEvents: function() {
      return {
        zoom: this._reset,
        viewreset: this._reset,
        moveend: this._reset,
        resize: this._reset
      };
    },
    onAdd: function(map) {
      this._canvas = document.createElement("canvas");
      this._context = this._canvas.getContext("morph");
      this._updateOpacity();
      this.getPane().appendChild(this._canvas);
      if (this.options.interactive) {
        L.DomUtil.addClass(this._canvas, 'leaflet-interactive');
        this.addInteractiveTarget(this._canvas);
      }
      this._initImage();
    },
    onRemove: function(map) {
      L.DomUtil.remove(this._canvas);
      if (this.options.interactive) {
        this.removeInteractiveTarget(this._canvas);
      }
    },
    _reset: function() {
      if (!this._canvas || !this._rawImage) return;

      var s = this._map.getSize();
      this._canvas.width = s.x;
      this._canvas.height = s.y;
      this._canvas.style.width = s.x + "px";
      this._canvas.style.height = s.y + "px";
      L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]));

      this._context.clear();
      this._context.drawImage(this._rawImage, this._groundControlPoints.map(function(a) {
        var p = a.imagePoint;
        var q = map.latLngToContainerPoint(a.latlng);
        return [p.x, p.y, q.x, q.y];
      }));
    },
    containerPointToImagePoint: function(containerPoint) {
      if (this._canvas && this._rawImage) {
        var xy = this._context.getTexturePointAt(containerPoint.x, containerPoint.y);
        if (xy) return L.point(xy[0], xy[1]);
      }
      return null;
    }
  });

  L.imageOverlay.gcp = function(url, groundControlPoints, options) {
    return new L.ImageOverlay.GCP(url, groundControlPoints, options);
  };

}
