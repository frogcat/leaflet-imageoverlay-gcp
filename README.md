# leaflet-imageoverlay-gcp
A Leaflet plugin to overlay image with ground control points

## Demo

- <https://frogcat.github.io/leaflet-imageoverlay-gcp/dist/>

## Usage

```html
<!-- import leaflet-imageoverlay-gcp.min.js to add L.ImageOverlay.GCP -->
<script src='https://frogcat.github.io/leaflet-imageoverlay-gcp/dist/leaflet-imageoverlay-gcp.min.js'/>

<script>
  // create imageoverlay with control points array
  var layer = L.imageOverlay.gcp("640x480.jpg", [
    {imagePoint:L.point(0,0), latlng:L.latLng(35,135)},
    {imagePoint:L.point(640,0), latlng:L.latLng(35,140)},
    {imagePoint:L.point(640,480), latlng:L.latLng(34,140)},
    {imagePoint:L.point(0,480), latlng:L.latLng(34,135)}
  ], {
    opacity: 0.75
  }).addTo(map);

  // You can update controlPoints
  layer.setGroundControlPoints([
    {imagePoint:L.point(0,0), latlng:L.latLng(35,135)},
    {imagePoint:L.point(640,0), latlng:L.latLng(35,140)},
    {imagePoint:L.point(640,480), latlng:L.latLng(34,140)},
    {imagePoint:L.point(0,480), latlng:L.latLng(34,135)},
    {imagePoint:L.point(320,240), latlng:L.latLng(34.2,137)}
  ]);

  layer.on("click",function(e){
    var cp = e.containerPoint;
    // call containerPointToImagePoint to get corresponding image point
    var ip = layer.containerPointToImagePoint(cp);
  });
</script>

```

## Creation

```
L.imageOverlay.gcp(<String> imageUrl,<ControlPoint[]> controlPoints,<ImageOverlay options> options?)
```

- ControlPoint is Object with `imagePoint` property, and `latlng` property.
- Value of `imagePoint` property must be instance of `L.Point`.
- Value of `latlng` property must be instance of `L.LatLng`.

## Methods


Method                        | Returns | Description
----------------------------- | ------- | ----------------------------------------------
setGroundControlPoints(<ControlPoint[]> controlPoints) | this    | Update all groundControlPoints
containerPointToImagePoint(<Point> p)            | Point    | Given a pixel coordinate relative to the map container, returns the corresponding pixel coordinate relative to the original image's top left.
