/** Handling classes. 1 is the base kart. */

export const CAR_STORAGE = 'docao-kart-car';
export const DEFAULT_CAR = 'arranque';

export const CARS = [
  {
    id: 'veloz',
    name: 'Veloz',
    line: 'Velocidade alta · curva baixa · aceleração média',
    speed: 1.24,
    accel: 1,
    corner: 0.7,
    body: 0xf4a259,
    accent: 0xffe08a,
  },
  {
    id: 'arranque',
    name: 'Arranque',
    line: 'Aceleração alta · velocidade média · curva média',
    speed: 1,
    accel: 1.36,
    corner: 1,
    body: 0xff4f8b,
    accent: 0xffd84a,
  },
  {
    id: 'fechada',
    name: 'Fechada',
    line: 'Curva alta · velocidade baixa · aceleração média',
    speed: 0.76,
    accel: 1,
    corner: 1.36,
    body: 0x2ec4b6,
    accent: 0xc8f7dc,
  },
];

export function getCar(id) {
  return CARS.find((car) => car.id === id) || CARS.find((car) => car.id === DEFAULT_CAR);
}

export function applyCar(racer, id) {
  const car = getCar(id);
  racer.car = car.id;
  racer.speedMul = car.speed;
  racer.accelMul = car.accel;
  racer.cornerMul = car.corner;
  return car;
}
