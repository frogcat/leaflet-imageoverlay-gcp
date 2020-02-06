(function () {
    'use strict';

    var EPSILON = Math.pow(2, -52);
    var EDGE_STACK = new Uint32Array(512);

    var Delaunator = function Delaunator(coords) {
        var n = coords.length >> 1;
        if (n > 0 && typeof coords[0] !== 'number') { throw new Error('Expected coords to contain numbers.'); }

        this.coords = coords;

        // arrays that will store the triangulation graph
        var maxTriangles = Math.max(2 * n - 5, 0);
        this._triangles = new Uint32Array(maxTriangles * 3);
        this._halfedges = new Int32Array(maxTriangles * 3);

        // temporary arrays for tracking the edges of the advancing convex hull
        this._hashSize = Math.ceil(Math.sqrt(n));
        this._hullPrev = new Uint32Array(n); // edge to prev edge
        this._hullNext = new Uint32Array(n); // edge to next edge
        this._hullTri = new Uint32Array(n); // edge to adjacent triangle
        this._hullHash = new Int32Array(this._hashSize).fill(-1); // angular edge hash

        // temporary arrays for sorting points
        this._ids = new Uint32Array(n);
        this._dists = new Float64Array(n);

        this.update();
    };

    Delaunator.from = function from (points, getX, getY) {
            if ( getX === void 0 ) getX = defaultGetX;
            if ( getY === void 0 ) getY = defaultGetY;

        var n = points.length;
        var coords = new Float64Array(n * 2);

        for (var i = 0; i < n; i++) {
            var p = points[i];
            coords[2 * i] = getX(p);
            coords[2 * i + 1] = getY(p);
        }

        return new Delaunator(coords);
    };

    Delaunator.prototype.update = function update () {
        var ref =  this;
            var coords = ref.coords;
            var hullPrev = ref._hullPrev;
            var hullNext = ref._hullNext;
            var hullTri = ref._hullTri;
            var hullHash = ref._hullHash;
        var n = coords.length >> 1;

        // populate an array of point indices; calculate input data bbox
        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;

        for (var i = 0; i < n; i++) {
            var x = coords[2 * i];
            var y = coords[2 * i + 1];
            if (x < minX) { minX = x; }
            if (y < minY) { minY = y; }
            if (x > maxX) { maxX = x; }
            if (y > maxY) { maxY = y; }
            this._ids[i] = i;
        }
        var cx = (minX + maxX) / 2;
        var cy = (minY + maxY) / 2;

        var minDist = Infinity;
        var i0, i1, i2;

        // pick a seed point close to the center
        for (var i$1 = 0; i$1 < n; i$1++) {
            var d = dist(cx, cy, coords[2 * i$1], coords[2 * i$1 + 1]);
            if (d < minDist) {
                i0 = i$1;
                minDist = d;
            }
        }
        var i0x = coords[2 * i0];
        var i0y = coords[2 * i0 + 1];

        minDist = Infinity;

        // find the point closest to the seed
        for (var i$2 = 0; i$2 < n; i$2++) {
            if (i$2 === i0) { continue; }
            var d$1 = dist(i0x, i0y, coords[2 * i$2], coords[2 * i$2 + 1]);
            if (d$1 < minDist && d$1 > 0) {
                i1 = i$2;
                minDist = d$1;
            }
        }
        var i1x = coords[2 * i1];
        var i1y = coords[2 * i1 + 1];

        var minRadius = Infinity;

        // find the third point which forms the smallest circumcircle with the first two
        for (var i$3 = 0; i$3 < n; i$3++) {
            if (i$3 === i0 || i$3 === i1) { continue; }
            var r = circumradius(i0x, i0y, i1x, i1y, coords[2 * i$3], coords[2 * i$3 + 1]);
            if (r < minRadius) {
                i2 = i$3;
                minRadius = r;
            }
        }
        var i2x = coords[2 * i2];
        var i2y = coords[2 * i2 + 1];

        if (minRadius === Infinity) {
            // order collinear points by dx (or dy if all x are identical)
            // and return the list as a hull
            for (var i$4 = 0; i$4 < n; i$4++) {
                this._dists[i$4] = (coords[2 * i$4] - coords[0]) || (coords[2 * i$4 + 1] - coords[1]);
            }
            quicksort(this._ids, this._dists, 0, n - 1);
            var hull = new Uint32Array(n);
            var j = 0;
            for (var i$5 = 0, d0 = -Infinity; i$5 < n; i$5++) {
                var id = this._ids[i$5];
                if (this._dists[id] > d0) {
                    hull[j++] = id;
                    d0 = this._dists[id];
                }
            }
            this.hull = hull.subarray(0, j);
            this.triangles = new Uint32Array(0);
            this.halfedges = new Uint32Array(0);
            return;
        }

        // swap the order of the seed points for counter-clockwise orientation
        if (orient(i0x, i0y, i1x, i1y, i2x, i2y)) {
            var i$6 = i1;
            var x$1 = i1x;
            var y$1 = i1y;
            i1 = i2;
            i1x = i2x;
            i1y = i2y;
            i2 = i$6;
            i2x = x$1;
            i2y = y$1;
        }

        var center = circumcenter(i0x, i0y, i1x, i1y, i2x, i2y);
        this._cx = center.x;
        this._cy = center.y;

        for (var i$7 = 0; i$7 < n; i$7++) {
            this._dists[i$7] = dist(coords[2 * i$7], coords[2 * i$7 + 1], center.x, center.y);
        }

        // sort the points by distance from the seed triangle circumcenter
        quicksort(this._ids, this._dists, 0, n - 1);

        // set up the seed triangle as the starting hull
        this._hullStart = i0;
        var hullSize = 3;

        hullNext[i0] = hullPrev[i2] = i1;
        hullNext[i1] = hullPrev[i0] = i2;
        hullNext[i2] = hullPrev[i1] = i0;

        hullTri[i0] = 0;
        hullTri[i1] = 1;
        hullTri[i2] = 2;

        hullHash.fill(-1);
        hullHash[this._hashKey(i0x, i0y)] = i0;
        hullHash[this._hashKey(i1x, i1y)] = i1;
        hullHash[this._hashKey(i2x, i2y)] = i2;

        this.trianglesLen = 0;
        this._addTriangle(i0, i1, i2, -1, -1, -1);

        for (var k = 0, xp = (void 0), yp = (void 0); k < this._ids.length; k++) {
            var i$8 = this._ids[k];
            var x$2 = coords[2 * i$8];
            var y$2 = coords[2 * i$8 + 1];

            // skip near-duplicate points
            if (k > 0 && Math.abs(x$2 - xp) <= EPSILON && Math.abs(y$2 - yp) <= EPSILON) { continue; }
            xp = x$2;
            yp = y$2;

            // skip seed triangle points
            if (i$8 === i0 || i$8 === i1 || i$8 === i2) { continue; }

            // find a visible edge on the convex hull using edge hash
            var start = 0;
            for (var j$1 = 0, key = this._hashKey(x$2, y$2); j$1 < this._hashSize; j$1++) {
                start = hullHash[(key + j$1) % this._hashSize];
                if (start !== -1 && start !== hullNext[start]) { break; }
            }

            start = hullPrev[start];
            var e = start, q = (void 0);
            while (q = hullNext[e], !orient(x$2, y$2, coords[2 * e], coords[2 * e + 1], coords[2 * q], coords[2 * q + 1])) {
                e = q;
                if (e === start) {
                    e = -1;
                    break;
                }
            }
            if (e === -1) { continue; } // likely a near-duplicate point; skip it

            // add the first triangle from the point
            var t = this._addTriangle(e, i$8, hullNext[e], -1, -1, hullTri[e]);

            // recursively flip triangles from the point until they satisfy the Delaunay condition
            hullTri[i$8] = this._legalize(t + 2);
            hullTri[e] = t; // keep track of boundary triangles on the hull
            hullSize++;

            // walk forward through the hull, adding more triangles and flipping recursively
            var n$1 = hullNext[e];
            while (q = hullNext[n$1], orient(x$2, y$2, coords[2 * n$1], coords[2 * n$1 + 1], coords[2 * q], coords[2 * q + 1])) {
                t = this._addTriangle(n$1, i$8, q, hullTri[i$8], -1, hullTri[n$1]);
                hullTri[i$8] = this._legalize(t + 2);
                hullNext[n$1] = n$1; // mark as removed
                hullSize--;
                n$1 = q;
            }

            // walk backward from the other side, adding more triangles and flipping
            if (e === start) {
                while (q = hullPrev[e], orient(x$2, y$2, coords[2 * q], coords[2 * q + 1], coords[2 * e], coords[2 * e + 1])) {
                    t = this._addTriangle(q, i$8, e, -1, hullTri[e], hullTri[q]);
                    this._legalize(t + 2);
                    hullTri[q] = t;
                    hullNext[e] = e; // mark as removed
                    hullSize--;
                    e = q;
                }
            }

            // update the hull indices
            this._hullStart = hullPrev[i$8] = e;
            hullNext[e] = hullPrev[n$1] = i$8;
            hullNext[i$8] = n$1;

            // save the two new edges in the hash table
            hullHash[this._hashKey(x$2, y$2)] = i$8;
            hullHash[this._hashKey(coords[2 * e], coords[2 * e + 1])] = e;
        }

        this.hull = new Uint32Array(hullSize);
        for (var i$9 = 0, e$1 = this._hullStart; i$9 < hullSize; i$9++) {
            this.hull[i$9] = e$1;
            e$1 = hullNext[e$1];
        }

        // trim typed triangle mesh arrays
        this.triangles = this._triangles.subarray(0, this.trianglesLen);
        this.halfedges = this._halfedges.subarray(0, this.trianglesLen);
    };

    Delaunator.prototype._hashKey = function _hashKey (x, y) {
        return Math.floor(pseudoAngle(x - this._cx, y - this._cy) * this._hashSize) % this._hashSize;
    };

    Delaunator.prototype._legalize = function _legalize (a) {
        var ref = this;
            var triangles = ref._triangles;
            var halfedges = ref._halfedges;
            var coords = ref.coords;

        var i = 0;
        var ar = 0;

        // recursion eliminated with a fixed-size stack
        while (true) {
            var b = halfedges[a];

            /* if the pair of triangles doesn't satisfy the Delaunay condition
             * (p1 is inside the circumcircle of [p0, pl, pr]), flip them,
             * then do the same check/flip recursively for the new pair of triangles
             *
             *       pl                pl
             *      /||\              /  \
             *   al/ || \bl        al/\a
             *    /  ||  \          /  \
             *   /  a||b  \flip/___ar___\
             * p0\   ||   /p1   =>   p0\---bl---/p1
             *    \  ||  /          \  /
             *   ar\ || /br         b\/br
             *      \||/              \  /
             *       pr                pr
             */
            var a0 = a - a % 3;
            ar = a0 + (a + 2) % 3;

            if (b === -1) { // convex hull edge
                if (i === 0) { break; }
                a = EDGE_STACK[--i];
                continue;
            }

            var b0 = b - b % 3;
            var al = a0 + (a + 1) % 3;
            var bl = b0 + (b + 2) % 3;

            var p0 = triangles[ar];
            var pr = triangles[a];
            var pl = triangles[al];
            var p1 = triangles[bl];

            var illegal = inCircle(
                coords[2 * p0], coords[2 * p0 + 1],
                coords[2 * pr], coords[2 * pr + 1],
                coords[2 * pl], coords[2 * pl + 1],
                coords[2 * p1], coords[2 * p1 + 1]);

            if (illegal) {
                triangles[a] = p1;
                triangles[b] = p0;

                var hbl = halfedges[bl];

                // edge swapped on the other side of the hull (rare); fix the halfedge reference
                if (hbl === -1) {
                    var e = this._hullStart;
                    do {
                        if (this._hullTri[e] === bl) {
                            this._hullTri[e] = a;
                            break;
                        }
                        e = this._hullPrev[e];
                    } while (e !== this._hullStart);
                }
                this._link(a, hbl);
                this._link(b, halfedges[ar]);
                this._link(ar, bl);

                var br = b0 + (b + 1) % 3;

                // don't worry about hitting the cap: it can only happen on extremely degenerate input
                if (i < EDGE_STACK.length) {
                    EDGE_STACK[i++] = br;
                }
            } else {
                if (i === 0) { break; }
                a = EDGE_STACK[--i];
            }
        }

        return ar;
    };

    Delaunator.prototype._link = function _link (a, b) {
        this._halfedges[a] = b;
        if (b !== -1) { this._halfedges[b] = a; }
    };

    // add a new triangle given vertex indices and adjacent half-edge ids
    Delaunator.prototype._addTriangle = function _addTriangle (i0, i1, i2, a, b, c) {
        var t = this.trianglesLen;

        this._triangles[t] = i0;
        this._triangles[t + 1] = i1;
        this._triangles[t + 2] = i2;

        this._link(t, a);
        this._link(t + 1, b);
        this._link(t + 2, c);

        this.trianglesLen += 3;

        return t;
    };

    // monotonically increases with real angle, but doesn't need expensive trigonometry
    function pseudoAngle(dx, dy) {
        var p = dx / (Math.abs(dx) + Math.abs(dy));
        return (dy > 0 ? 3 - p : 1 + p) / 4; // [0..1]
    }

    function dist(ax, ay, bx, by) {
        var dx = ax - bx;
        var dy = ay - by;
        return dx * dx + dy * dy;
    }

    // return 2d orientation sign if we're confident in it through J. Shewchuk's error bound check
    function orientIfSure(px, py, rx, ry, qx, qy) {
        var l = (ry - py) * (qx - px);
        var r = (rx - px) * (qy - py);
        return Math.abs(l - r) >= 3.3306690738754716e-16 * Math.abs(l + r) ? l - r : 0;
    }

    // a more robust orientation test that's stable in a given triangle (to fix robustness issues)
    function orient(rx, ry, qx, qy, px, py) {
        var sign = orientIfSure(px, py, rx, ry, qx, qy) ||
        orientIfSure(rx, ry, qx, qy, px, py) ||
        orientIfSure(qx, qy, px, py, rx, ry);
        return sign < 0;
    }

    function inCircle(ax, ay, bx, by, cx, cy, px, py) {
        var dx = ax - px;
        var dy = ay - py;
        var ex = bx - px;
        var ey = by - py;
        var fx = cx - px;
        var fy = cy - py;

        var ap = dx * dx + dy * dy;
        var bp = ex * ex + ey * ey;
        var cp = fx * fx + fy * fy;

        return dx * (ey * cp - bp * fy) -
               dy * (ex * cp - bp * fx) +
               ap * (ex * fy - ey * fx) < 0;
    }

    function circumradius(ax, ay, bx, by, cx, cy) {
        var dx = bx - ax;
        var dy = by - ay;
        var ex = cx - ax;
        var ey = cy - ay;

        var bl = dx * dx + dy * dy;
        var cl = ex * ex + ey * ey;
        var d = 0.5 / (dx * ey - dy * ex);

        var x = (ey * bl - dy * cl) * d;
        var y = (dx * cl - ex * bl) * d;

        return x * x + y * y;
    }

    function circumcenter(ax, ay, bx, by, cx, cy) {
        var dx = bx - ax;
        var dy = by - ay;
        var ex = cx - ax;
        var ey = cy - ay;

        var bl = dx * dx + dy * dy;
        var cl = ex * ex + ey * ey;
        var d = 0.5 / (dx * ey - dy * ex);

        var x = ax + (ey * bl - dy * cl) * d;
        var y = ay + (dx * cl - ex * bl) * d;

        return {x: x, y: y};
    }

    function quicksort(ids, dists, left, right) {
        if (right - left <= 20) {
            for (var i = left + 1; i <= right; i++) {
                var temp = ids[i];
                var tempDist = dists[temp];
                var j = i - 1;
                while (j >= left && dists[ids[j]] > tempDist) { ids[j + 1] = ids[j--]; }
                ids[j + 1] = temp;
            }
        } else {
            var median = (left + right) >> 1;
            var i$1 = left + 1;
            var j$1 = right;
            swap(ids, median, i$1);
            if (dists[ids[left]] > dists[ids[right]]) { swap(ids, left, right); }
            if (dists[ids[i$1]] > dists[ids[right]]) { swap(ids, i$1, right); }
            if (dists[ids[left]] > dists[ids[i$1]]) { swap(ids, left, i$1); }

            var temp$1 = ids[i$1];
            var tempDist$1 = dists[temp$1];
            while (true) {
                do { i$1++; } while (dists[ids[i$1]] < tempDist$1);
                do { j$1--; } while (dists[ids[j$1]] > tempDist$1);
                if (j$1 < i$1) { break; }
                swap(ids, i$1, j$1);
            }
            ids[left + 1] = ids[j$1];
            ids[j$1] = temp$1;

            if (right - i$1 + 1 >= j$1 - left) {
                quicksort(ids, dists, i$1, right);
                quicksort(ids, dists, left, j$1 - 1);
            } else {
                quicksort(ids, dists, left, j$1 - 1);
                quicksort(ids, dists, i$1, right);
            }
        }
    }

    function swap(arr, i, j) {
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    function defaultGetX(p) {
        return p[0];
    }
    function defaultGetY(p) {
        return p[1];
    }

    (function(HTMLCanvasElement) {

      // 3x3 行列の掛け算
      function multiply(a, b) {
        var m = [];
        for (var i = 0; i < b.length; i += 3)
          { for (var j = 0; j < 3; j++)
            { m.push(a[j + 0] * b[i + 0] + a[j + 3] * b[i + 1] + a[j + 6] * b[i + 2]); } }
        return m;
      }

      // 3x3 行列の逆行列
      function inverse(a) {
        var det = a[0] * a[4] * a[8] + a[3] * a[7] * a[2] + a[6] * a[1] * a[5] -
          a[0] * a[7] * a[5] - a[6] * a[4] * a[2] - a[3] * a[1] * a[8];
        return [
          (a[4] * a[8] - a[7] * a[5]) / det,
          (a[7] * a[2] - a[1] * a[8]) / det,
          (a[1] * a[5] - a[4] * a[2]) / det,
          (a[6] * a[5] - a[3] * a[8]) / det,
          (a[0] * a[8] - a[6] * a[2]) / det,
          (a[3] * a[2] - a[0] * a[5]) / det,
          (a[3] * a[7] - a[6] * a[4]) / det,
          (a[6] * a[1] - a[0] * a[7]) / det,
          (a[0] * a[4] - a[1] * a[3]) / det
        ];
      }

      // ベクトルの引き算
      function subtract(a, b) {
        return [a[0] - b[0], a[1] - b[1]];
      }
      // ベクトルの外積
      function cross(a, b) {
        return a[0] * b[1] - a[1] * b[0];
      }

      // 三角形と点の内外判定
      function pointWithInTriangle(p, triangle) {
        var v12 = subtract(triangle[1], triangle[0]);
        var v23 = subtract(triangle[2], triangle[1]);
        var v31 = subtract(triangle[0], triangle[2]);
        var v10 = subtract(p, triangle[0]);
        var v20 = subtract(p, triangle[1]);
        var v30 = subtract(p, triangle[2]);
        var c1 = cross(v12, v20);
        var c2 = cross(v23, v30);
        var c3 = cross(v31, v10);
        return ((c1 > 0 && c2 > 0 && c3 > 0) || (c1 < 0 && c2 < 0 && c3 < 0));
      }

      // from から to への変換行列
      function createTransformMatrix(from, to) {
        var m1 = [from[0][0], from[0][1], 1, from[1][0], from[1][1], 1, from[2][0], from[2][1], 1];
        var m2 = [to[0][0], to[0][1], 1, to[1][0], to[1][1], 1, to[2][0], to[2][1], 1];
        return multiply(m2, inverse(m1));
      }



      var getContext = HTMLCanvasElement.prototype.getContext;

      HTMLCanvasElement.prototype.getContext = function(id, options) {
        var canvas = this;
        if (id !== "morph") { return getContext.apply(canvas, [id, options]); }

        var gl = canvas.getContext('webgl', {
          preserveDrawingBuffer: true
        });
        var pg = this.pg = gl.createProgram();

        (function(shader) {
          gl.shaderSource(shader, "attribute vec4 p;varying vec2 a;uniform vec4 m;void main(){vec4 q=m*p;gl_Position=vec4(q.zw,0,1)+vec4(-1,1,0,0);a=q.xy;}");
          gl.compileShader(shader);
          gl.attachShader(pg, shader);
        })(gl.createShader(gl.VERTEX_SHADER));

        (function(shader) {
          gl.shaderSource(shader, "precision mediump float;uniform sampler2D i;varying vec2 a;void main(){gl_FragColor=texture2D(i,a);}");
          gl.compileShader(shader);
          gl.attachShader(pg, shader);
        })(gl.createShader(gl.FRAGMENT_SHADER));

        gl.linkProgram(pg);
        if (gl.getProgramParameter(pg, gl.LINK_STATUS)) {
          gl.useProgram(pg);
        } else {
          throw new Error(gl.getProgramInfoLog(pg));
        }

        var _previousImage = null;
        var _previousCopy = null;

        return {
          _coords: null,
          canvas: canvas,
          drawImage: function(image, controlPoints) {
            if (_previousImage !== image) {

              _previousCopy = document.createElement("canvas");
              _previousCopy.width = Math.pow(2, Math.ceil(Math.log2(image.naturalWidth)));
              _previousCopy.height = Math.pow(2, Math.ceil(Math.log2(image.naturalHeight)));
              _previousCopy.getContext("2d").drawImage(image, 0, 0);

              (function(texture) {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, _previousCopy);
              })(gl.createTexture());

              _previousImage = image;
            }

            var coords = [];
            Delaunator.from(controlPoints).triangles.forEach(function(i) {
              Array.prototype.push.apply(coords, controlPoints[i]);
            });

            this._coords = coords;

            (function(location) {
              gl.uniform4f(location, 1 / _previousCopy.width, 1 / _previousCopy.height, 2 / canvas.width, -2 / canvas.height);
            })(gl.getUniformLocation(pg, "m"));

            var buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);

            var location = gl.getAttribLocation(pg, "p");
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, coords.length / 4);
          },
          clear: function() {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
          },
          getTexturePointAt: function(x, y) {
            var coords = this._coords;
            for (var i = 0; i < coords.length; i += 12) {
              var canvasTriangle = [
                [coords[i + 2], coords[i + 3]],
                [coords[i + 6], coords[i + 7]],
                [coords[i + 10], coords[i + 11]]
              ];
              var textureTriangle = [
                [coords[i + 0], coords[i + 1]],
                [coords[i + 4], coords[i + 5]],
                [coords[i + 8], coords[i + 9]]
              ];
              if (pointWithInTriangle([x, y], canvasTriangle)) {
                var m = createTransformMatrix(canvasTriangle, textureTriangle);
                var q = multiply(m, [x, y, 1]);
                return [q[0], q[1]];
              }
            }
            return null;
          }
        };
      };
    })(window.HTMLCanvasElement);

    (function(L) {

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
          if (!this._canvas || !this._rawImage) { return; }

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
            if (xy) { return L.point(xy[0], xy[1]); }
          }
          return null;
        }
      });

      L.imageOverlay.gcp = function(url, groundControlPoints, options) {
        return new L.ImageOverlay.GCP(url, groundControlPoints, options);
      };

    })(window.L);

}());
