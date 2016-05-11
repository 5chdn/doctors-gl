let m, o, c;
let gl, sp;
let EARTH_EQUATOR = 40075016.68557849;
let DEFAULT_CENTER = [52.319026, 13.554639];
let DEFAULT_ZOOM = 6;
let VERTICES = [];

function doctors_gl() {
  m = L.map('map', {});
  m.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  o = L.canvasOverlay().drawing(drawGL).addTo(m);
  c = o.canvas()
  o.canvas.width = c.clientWidth;
  o.canvas.height = c.clientHeight;
  initGL();
  initShaders();
  let bgTiles = L.tileLayer(
    'http://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    {
      subdomains: 'abcd',
      maxZoom: 19
  }).addTo(m);
  createDoctorBuffer();
  drawGL();
}

function initGL() {
  gl = WebGLDebugUtils.makeDebugContext(
    WebGLUtils.setupWebGL(c),
    throwOnGLError
  );
  WebGLDebugUtils.init(gl);
}

function initShaders() {
  let vShader = getShader("shader-vtx");
  let fShader = getShader("shader-frg");
  sp = gl.createProgram();
  gl.attachShader(sp, vShader);
  gl.attachShader(sp, fShader);
  gl.linkProgram(sp);
  if (!gl.getProgramParameter(sp, gl.LINK_STATUS)) {
    _log("initShaders(): [ERR]: could not init shaders");
  } else {
    gl.useProgram(sp);
    sp.uniformMatrix = gl.getUniformLocation(sp, "u_matrix");
    sp.vertexPosition = gl.getAttribLocation(sp, "a_vertex");
    gl.enableVertexAttribArray(sp.vertexPosition);
  }
}

function getShader(id) {
  let shader;
  let shaderScript = document.getElementById(id);
  if (!shaderScript) {
    _log("getShader(id): [WRN]: shader not found");
    return null;
  }
  let str = "";
  let k = shaderScript.firstChild;
  while (k) {
    if (k.nodeType == 3)
      str += k.textContent;
    k = k.nextSibling;
  }
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    _log("getShader(id): [WRN]: unknown shader type");
    return null;
  }
  gl.shaderSource(shader, str);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    _log("getShader(id): [ERR]: shader failed to compile");
    _log(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function createDoctorBuffer() {
  featureSet = doctors.features;
  $.each(featureSet, function(i, f) {
    let c = f.geometry.coordinates;
    let p = L.point(c);
    let v = mercatorToPixels(p);
    VERTICES.push(v.x);
    VERTICES.push(v.y);
  });
  VERTICES = new Float32Array(VERTICES);
}

function drawGL() {
  if (gl) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, c.width, c.height);
    let bounds = m.getBounds();
    let topLeft = new L.LatLng(bounds.getNorth(), bounds.getWest());
    let zoom = m.getZoom();
    let scale = Math.pow(2, zoom) * 256.0;
    let offset = latLonToPixels(topLeft.lat, topLeft.lng);
    let width = Math.max(zoom - 12.0, 1.0);
    let vtxSize = 2;
    let uMatrix = new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);
    translateMatrix(uMatrix, -1, 1);
    scaleMatrix(uMatrix, 2.0 / c.width, -2.0 / c.height);
    scaleMatrix(uMatrix, scale, scale);
    translateMatrix(uMatrix, -offset.x, -offset.y);
    gl.uniformMatrix4fv(sp.uniformMatrix, false, uMatrix);
    gl.lineWidth(width);
    let vtxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vtxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);
    gl.vertexAttribPointer(sp.vertexPosition, vtxSize, gl.FLOAT, false, 0, 0);
    let count = VERTICES.length / 2.0 - 1;
    gl.drawArrays(gl.POINTS, 0, count);
//    gl.drawElements(gl.LINES, tileBuffers[i].getIndexBuffer().length, gl.UNSIGNED_SHORT, idxBuffer);
  }
}

function translateMatrix(m, x, y) {
  m[12] += m[0] * x + m[4] * y;
  m[13] += m[1] * x + m[5] * y;
  m[14] += m[2] * x + m[6] * y;
  m[15] += m[3] * x + m[7] * y;
}

function scaleMatrix(m, x, y) {
  m[0] *= x;
  m[1] *= x;
  m[2] *= x;
  m[3] *= x;
  m[4] *= y;
  m[5] *= y;
  m[6] *= y;
  m[7] *= y;
}

function mercatorToPixels(p)  {
  let pixelX = (p.x + (EARTH_EQUATOR / 2.0)) / EARTH_EQUATOR;
  let pixelY = ((p.y - (EARTH_EQUATOR / 2.0)) / -EARTH_EQUATOR);
  return L.point(pixelX, pixelY);
}

function latLonToPixels(lat, lon) {
  let sinLat = Math.sin(lat * Math.PI / 180.0);
  let pixelX = ((lon + 180) / 360);
  let pixelY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (Math.PI * 4));
  return L.point(pixelX, pixelY);
}

function _log(s) {
  let n = new Date().getTime() / 1000.0;
  window.console.log('[' + n.toFixed(3) + '] ' + s);
}

function throwOnGLError(e, f, args) {
  throw WebGLDebugUtils.glEnumToString(e) + " was caused by call to " + f;
}
