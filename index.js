// handtracking 
// read video from webcam
/* global describe handpose tf io THREE*/
// html canvas for drawing debug view
function updateMeshes(hand) {
  for (var i = 0; i < handMeshes.length; i++) {
    var {
      isPalm,
      next
    } = getLandmarkProperty(i);
    var p0 = webcam2space(...hand.landmarks[i]); // one end of the bone
    var p1 = webcam2space(...hand.landmarks[next]); // the other end of the bone
    // compute the center of the bone (midpoint)
    var mid = p0.clone().lerp(p1, 0.5);
    handMeshes[i].position.set(mid.x, mid.y, mid.z);
    // compute the length of the bone
    handMeshes[i].scale.z = p0.distanceTo(p1);
    // compute orientation of the bone
    handMeshes[i].lookAt(p1);
  }
}
handpose.load().then(function(_model) {
  console.log("model initialized.")
  statusText = "Model loaded."
  handposeModel = _model;
})
// compute some metadata given a landmark index
// - is the landmark a palm keypoint or a finger keypoint?
// - what's the next landmark to connect to if we're drawing a bone?
function getLandmarkProperty(i) {
  var palms = [0, 1, 2, 5, 9, 13, 17] //landmark indices that represent the palm
  var idx = palms.indexOf(i);
  var isPalm = idx != -1;
  var next; // who to connect with?
  if (!isPalm) { // connect with previous finger landmark if it's a finger landmark
    next = i - 1;
  } else { // connect with next palm landmark if it's a palm landmark
    next = palms[(idx + 1) % palms.length];
  }
  return {
    isPalm,
    next
  };
}
// draw a hand object (2D debug view) returned by handpose
function drawHands(hands, noKeypoints) {
  // Each hand object contains a `landmarks` property,
  // which is an array of 21 3-D landmarks.
  for (var i = 0; i < hands.length; i++) {
    var landmarks = hands[i].landmarks;
    var palms = [0, 1, 2, 5, 9, 13, 17] //landmark indices that represent the palm
    for (var j = 0; j < landmarks.length; j++) {
      var [x, y, z] = landmarks[j]; // coordinate in 3D space
      // draw the keypoint and number
      if (!noKeypoints) {
        dbg.fillRect(x - 2, y - 2, 4, 4);
        dbg.fillText(j, x, y);
      }
      // draw the skeleton
      var {
        isPalm,
        next
      } = getLandmarkProperty(j);
      dbg.beginPath();
      dbg.moveTo(x, y);
      dbg.lineTo(...landmarks[next]);
      dbg.stroke();
    }
  }
}

function updateMeshes(hand) {
  for (var i = 0; i < handMeshes.length; i++) {
    var {
      isPalm,
      next
    } = getLandmarkProperty(i);
    var p0 = webcam2space(...hand.landmarks[i]); // one end of the bone
    var p1 = webcam2space(...hand.landmarks[next]); // the other end of the bone
    // compute the center of the bone (midpoint)
    var mid = p0.clone().lerp(p1, 0.5);
    handMeshes[i].position.set(mid.x, mid.y, mid.z);
    // compute the length of the bone
    handMeshes[i].scale.z = p0.distanceTo(p1);
    // compute orientation of the bone
    handMeshes[i].lookAt(p1);
  }
}

function webcam2space(x, y, z) {
  return new THREE.Vector3(
    (x - capture.videoWidth / 2), -(y - capture.videoHeight / 2), // in threejs, +y is up
    -z)
}
// AR
var scene, camera, renderer, clock, deltaTime, totalTime;
var arToolkitSource, arToolkitContext;
var markerRoot1, markerRoot2;
var mesh1;
var handposeModel = null; // this will be loaded with the handpose model
var videoDataLoaded = false; // is webcam capture ready?
var statusText = "Loading handpose model...";
var myHands = []; // hands detected
// currently handpose only supports single hand, so this will be either empty or singleton
var handMeshes = []; // array of threejs objects that makes up the hand rendering
// html canvas for drawing debug view
var dbg = document.createElement("canvas").getContext('2d');
initialize();
animate();

function initialize() {
  scene = new THREE.Scene();
  dbg.canvas.style.position = "absolute";
  dbg.canvas.style.left = "0px";
  dbg.canvas.style.top = "0px";
  dbg.canvas.style.zIndex = 100; // "bring to front"
  document.body.appendChild(dbg.canvas);
  let ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
  scene.add(ambientLight);
  camera = new THREE.Camera();
  scene.add(camera);
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setClearColor(new THREE.Color('lightgrey'), 0)
  renderer.setSize(640, 480);
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.top = '0px'
  renderer.domElement.style.left = '0px'
  document.body.appendChild(renderer.domElement);
  clock = new THREE.Clock();
  deltaTime = 0;
  totalTime = 0;
  ////////////////////////////////////////////////////////////
  // setup arToolkitSource
  ////////////////////////////////////////////////////////////
  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
  });

  function onResize() {
    arToolkitSource.onResize()
    arToolkitSource.copySizeTo(renderer.domElement)
    if (arToolkitContext.arController !== null) {
      arToolkitSource.copySizeTo(arToolkitContext.arController.canvas)
    }
  }
  arToolkitSource.init(function onReady() {
    onResize()
  });
  // handle resize event
  window.addEventListener('resize', function() {
    onResize()
  });
  ////////////////////////////////////////////////////////////
  // setup arToolkitContext
  ////////////////////////////////////////////////////////////	
  // create atToolkitContext
  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: 'data/camera_para.dat',
    detectionMode: 'mono'
  });
  for (var i = 0; i < 21; i++) { // 21 keypoints
    var {
      isPalm,
      next
    } = getLandmarkProperty(i);
    var obj = new THREE.Object3D(); // a parent object to facilitate rotation/scaling
    // we make each bone a cylindrical shape, but you can use your own models here too
    var geometry = new THREE.CylinderGeometry(isPalm ? 5 : 10, 5, 1);
    var material = new THREE.MeshNormalMaterial();
    // another possible material (after adding a light source):
    // var material = new THREE.MeshPhongMaterial({color:0x00ffff});
    var mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    obj.add(mesh);
    scene.add(obj);
    handMeshes.push(obj);
  }
  // copy projection matrix to camera when initialization complete
  arToolkitContext.init(function onCompleted() {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });
  ////////////////////////////////////////////////////////////
  // setup markerRoots
  ////////////////////////////////////////////////////////////
  let loader = new THREE.TextureLoader();
  let texture = loader.load('images/border.png');
  let patternArray = ["letterA", "letterB", "letterC", "letterD", "letterF", "kanji", "hiro"];
  let colorArray = [0xff0000, 0xff8800, 0xffff00, 0x00cc00, 0x0000ff, 0xcc00ff, 0xcccccc];
  for (let i = 0; i < 7; i++) {
    let markerRoot = new THREE.Group();
    scene.add(markerRoot);
    let markerControls = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
      type: 'pattern',
      patternUrl: "data/" + patternArray[i] + ".patt",
    });
    let mesh = new THREE.Mesh(new THREE.CubeGeometry(1.25, 1.25, 1.25), new THREE.MeshBasicMaterial({
      color: colorArray[i],
      map: texture,
      transparent: true,
      opacity: 0.5
    }));
    mesh.position.y = 1.25 / 2;
    markerRoot.add(mesh);
  }
}

function update() {
  // update artoolkit on every frame
  if (arToolkitSource.ready !== false) arToolkitContext.update(arToolkitSource.domElement);
}

function render() {
  requestAnimationFrame(render); // this creates an infinite animation loop
  if (handposeModel && videoDataLoaded) { // model and video both loaded
    debugger
    handposeModel.estimateHands(arToolkitContext.domElement).then(function(_hands) {
      // we're handling an async promise
      // best to avoid drawing something here! it might produce weird results due to racing
      myHands = _hands; // update the global myHands object with the detected hands
      console.log(myHands)
      if (!myHands.length) {
        // haven't found any hands
        statusText = "Show some hands!"
      } else {
        // display the confidence, to 3 decimal places
        statusText = "Confidence: " + (Math.round(myHands[0].handInViewConfidence * 1000) / 1000);
        // update 3d objects
        updateMeshes(myHands[0]);
      }
    })
  }
  dbg.clearRect(0, 0, dbg.canvas.width, dbg.canvas.height);
  dbg.save();
  dbg.fillStyle = "red";
  dbg.strokeStyle = "red";
  dbg.scale(0.5, 0.5); //halfsize;
  drawHands(myHands);
  dbg.restore();
  dbg.save();
  dbg.fillStyle = "red";
  dbg.fillText(statusText, 2, 60);
  dbg.restore();
  // render the 3D scene!
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  deltaTime = clock.getDelta();
  totalTime += deltaTime;
  update();
  render();
}
