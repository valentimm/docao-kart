import * as THREE from 'three';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function makeCapybara() {
  const group = new THREE.Group();
  const fur = lambert(0x8a5a32);
  const dark = lambert(0x5c3b22);
  const belly = lambert(0xc4a574);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), fur);
  body.scale.set(1.15, 0.72, 1.55);
  body.position.set(0, 0.62, 0);
  group.add(body);

  const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), belly);
  tummy.scale.set(0.9, 0.45, 1.2);
  tummy.position.set(0, 0.42, 0.05);
  group.add(tummy);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), fur);
  head.position.set(0, 0.78, 0.92);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), dark);
  snout.scale.set(1.1, 0.75, 1.35);
  snout.position.set(0, 0.66, 1.22);
  group.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), lambert(0x2a1408));
  nose.position.set(0, 0.7, 1.46);
  group.add(nose);

  for (const x of [-0.16, 0.16]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), fur);
    ear.scale.set(0.7, 1, 0.45);
    ear.position.set(x, 1.08, 0.86);
    group.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), lambert(0x1a100c));
    eye.position.set(x * 0.7, 0.84, 1.22);
    group.add(eye);
  }

  const legs = [];
  const spots = [
    [-0.32, 0.42],
    [0.32, 0.42],
    [-0.32, -0.38],
    [0.32, -0.38],
  ];
  for (const [x, z] of spots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 6), dark);
    leg.position.y = -0.16;
    pivot.add(leg);
    group.add(pivot);
    legs.push(pivot);
  }

  return { group, legs };
}

export function createCapybaraView(scene, herd) {
  const animals = herd.map(() => {
    const animal = makeCapybara();
    scene.add(animal.group);
    return animal;
  });

  return {
    update(list, time) {
      list.forEach((data, index) => {
        const view = animals[index];
        if (!view) return;
        const step = Math.sin(time * 6.5 + data.phase);
        view.group.position.set(data.x, Math.abs(step) * 0.035, data.z);
        view.group.rotation.y = data.yaw;
        view.legs.forEach((leg, legIndex) => {
          const swing = legIndex % 2 === 0 ? step : -step;
          leg.rotation.x = swing * 0.55;
        });
      });
    },
    dispose() {
      for (const animal of animals) scene.remove(animal.group);
    },
  };
}
