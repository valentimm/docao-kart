import * as THREE from 'three';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function crateTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#e7a85a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#d08a3c';
    g.fillRect(0, 40, 128, 10);
    g.fillRect(0, 78, 128, 10);
    g.fillRect(40, 0, 10, 128);
    g.fillRect(78, 0, 10, 128);
    g.strokeStyle = '#8a4b2a';
    g.lineWidth = 10;
    g.strokeRect(5, 5, 118, 118);
    g.fillStyle = '#ff4f8b';
    g.fillRect(0, 0, 128, 12);
    g.fillRect(0, 116, 128, 12);
  });
}

function questionTexture() {
  return canvasTexture(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#ff4f8b';
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#5c3317';
    g.stroke();
    g.fillStyle = '#fffaf2';
    g.font = '800 86px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 64, 70);
  });
}

function makePamonha() {
  const group = new THREE.Group();
  const corn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.58, 8),
    new THREE.MeshLambertMaterial({ color: 0xffd84a }),
  );
  corn.rotation.z = Math.PI / 2;
  group.add(corn);
  const huskMat = new THREE.MeshLambertMaterial({ color: 0x6fbf45 });
  for (const side of [-1, 1]) {
    const husk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.2), huskMat);
    husk.position.set(0, 0.1, 0.1 * side);
    husk.rotation.x = side * 0.5;
    group.add(husk);
  }
  return group;
}

function makeCasca() {
  const geo = new THREE.TorusGeometry(0.34, 0.1, 5, 8, Math.PI * 1.25);
  geo.rotateX(Math.PI / 2.5);
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xffe14a }));
}

function makeTomate() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xef3d3d })));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshLambertMaterial({ color: 0x3d8f32 }));
  cap.position.y = 0.22;
  group.add(cap);
  return group;
}

export function createItemView(scene, field, racers) {
  const dummy = new THREE.Object3D();
  const boxes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.2, 1.05, 1.2),
    new THREE.MeshLambertMaterial({ map: crateTexture() }),
    field.boxes.length,
  );
  boxes.frustumCulled = false;
  scene.add(boxes);

  const qMat = new THREE.SpriteMaterial({
    map: questionTexture(),
    transparent: true,
    depthWrite: false,
  });
  const questions = field.boxes.map(() => {
    const sprite = new THREE.Sprite(qMat);
    sprite.scale.set(1.15, 1.15, 1);
    scene.add(sprite);
    return sprite;
  });

  const peels = field.peels.map(() => {
    const mesh = makeCasca();
    mesh.scale.setScalar(1.45);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const shots = field.shots.map(() => {
    const mesh = makeTomate();
    mesh.scale.setScalar(1.15);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const markers = racers.map(() => {
    const group = new THREE.Group();
    group.add(makePamonha());
    group.add(makeCasca());
    group.add(makeTomate());
    group.visible = false;
    scene.add(group);
    return group;
  });

  return {
    update(items, fieldRacers, time) {
      items.boxes.forEach((box, index) => {
        const bob = 0.78 + Math.sin(time * 3 + index) * 0.1;
        const shown = box.alive ? 0.55 + 0.45 * (box.pop > 0 ? 1 - box.pop / 0.26 : 1) : 0.001;
        dummy.position.set(box.x, box.alive ? bob : -6, box.z);
        dummy.rotation.set(0, time * 0.9 + index, 0);
        dummy.scale.setScalar(shown);
        dummy.updateMatrix();
        boxes.setMatrixAt(index, dummy.matrix);
        const mark = questions[index];
        mark.visible = box.alive;
        if (!box.alive) return;
        mark.position.set(box.x, bob + 0.95, box.z);
        const pulse = 1 + Math.sin(time * 5 + index) * 0.06;
        mark.scale.set(1.2 * pulse, 1.2 * pulse, 1);
      });
      boxes.instanceMatrix.needsUpdate = true;

      items.peels.forEach((peel, index) => {
        const mesh = peels[index];
        mesh.visible = peel.active;
        if (!peel.active) return;
        mesh.position.set(peel.x, 0.22, peel.z);
        mesh.rotation.y = peel.yaw + time;
      });
      items.shots.forEach((shot, index) => {
        const mesh = shots[index];
        mesh.visible = shot.active;
        if (!shot.active) return;
        mesh.position.set(shot.x, 0.7, shot.z);
        mesh.rotation.y = shot.yaw;
      });
      fieldRacers.forEach((racer, index) => {
        const marker = markers[index];
        const id = racer.item;
        marker.visible = !!id && !racer.finished;
        if (!marker.visible) return;
        marker.position.set(racer.x, 2.95 + Math.sin(time * 6 + index) * 0.05, racer.z);
        marker.rotation.y = racer.yaw;
        marker.children[0].visible = id === 'pamonha';
        marker.children[1].visible = id === 'casca';
        marker.children[2].visible = id === 'tomate';
      });
    },
  };
}
