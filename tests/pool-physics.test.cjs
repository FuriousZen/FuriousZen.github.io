const test = require("node:test");
const assert = require("node:assert/strict");
const physics = require("../pool-physics.js");

function body(x, y, rad, extra = {}) {
  const b = { x, y, r: 0, z: 0, wave: 0, circles: [{ x: 0, y: 0, rad }], ...extra };
  b.size = physics.radius(b);
  return b;
}

test("floaties cannot enter the outer corners of the outlined W", () => {
  const w = body(0, 0, 74, { box: physics.letterBox("W", 160, 168, 200) });
  for (const x of [-76.8, 76.8]) for (const y of [-77.28, 77.28]) {
    const float = body(x, y, 10), hit = physics.contact(w, float);
    assert(hit, `uncovered corner ${x}, ${y}`);
    float.x += hit.nx * (hit.depth + 0.01); float.y += hit.ny * (hit.depth + 0.01);
    assert.equal(physics.contact(w, float), null);
  }
});

test("entrance overshoot and wave lift expand the collision footprint", () => {
  const growing = body(0, 0, 50, { z: -0.18 }), float = body(70, 0, 15);
  assert(physics.contact(growing, float));
  growing.z = 0; growing.wave = 1.5;
  assert(physics.contact(growing, float));
  growing.wave = 0;
  assert.equal(physics.contact(growing, float), null);
  growing.z = 1;
  assert.equal(physics.collisionScale(growing), 1);
});

test("an exact centre spawn has an exit direction, for both letters and floats", () => {
  for (const box of [undefined, physics.letterBox("o", 100, 100, 120)]) {
    const a = body(0, 0, 50, { box }), b = body(0, 0, 10);
    const hit = physics.contact(a, b);
    assert(hit && Math.hypot(hit.nx, hit.ny) > 0.99);
    b.x += hit.nx * (hit.depth + 0.01); b.y += hit.ny * (hit.depth + 0.01);
    assert.equal(physics.contact(a, b), null);
  }
});

test("letter bounds rotate with the glyph and use the full offset radius", () => {
  for (const rotation of [-130, -45, 0, 35, 90, 175]) {
    const a = body(0, 0, 20, { box: physics.letterBox("m", 160, 100, 120), r: rotation });
    const x = a.box.hw - 1, y = a.box.y + a.box.hh - 1, radians = rotation * Math.PI / 180;
    const b = body(x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians), 4);
    assert(physics.contact(a, b), `miss at ${rotation} degrees`);
    const reverse = physics.contact(b, a);
    assert(reverse);
    assert(Math.abs(reverse.nx + physics.contact(a, b).nx) < 0.0001);
  }
});

test("offset float parts participate in both letter contacts and pool boundaries", () => {
  const float = body(100, 100, 30, { circles: [{ x: 0, y: 0, rad: 30 }, { x: 10, y: -60, rad: 14 }] });
  const letter = body(110, 30, 12, { box: physics.letterBox("i", 20, 30, 40) });
  assert(physics.contact(letter, float));
  assert.equal(physics.bounds(float).top, 26);
  assert(float.size > 74);
});

test("separated bodies have no contact and degenerate placements stay finite", () => {
  assert.equal(physics.contact(body(0, 0, 50), body(300, 0, 15)), null);
  for (let i = 0; i < 1000; i++) {
    const a = body(0, 0, 20, { box: physics.letterBox("a", 40 + i % 30, 60, 70), r: i * 17 });
    const b = body(Math.sin(i) * 35, Math.cos(i) * 35, 15, { z: -0.2 });
    const hit = physics.contact(a, b);
    if (hit) for (const value of Object.values(hit)) assert(Number.isFinite(value));
  }
});

test("floaties start outside letter outlines and stay within desktop and phone pools", () => {
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    const em = Math.min(260, width * 0.17);
    const letters = [..."WilliamWo"].map((ch, i) => {
      const lower = i > 6, index = lower ? i - 7 : i;
      const x = lower ? width * 0.4 + index * em : width * 0.08 + index * width * 0.12;
      const y = height * (lower ? 0.62 : 0.35);
      return body(x, y, em * 0.3, { box: physics.letterBox(ch, em * 0.6, em * 0.84, em), r: (i % 2 ? 1 : -1) * 10, z: 1 });
    });
    const floats = [];
    for (let i = 0; i < 6; i++) {
      const b = body(letters[i].x, letters[i].y, Math.max(25, em * 0.28), { z: 1 });
      assert(physics.settle(b, [...letters, ...floats], width, height), `no clear spawn at ${width}x${height}`);
      assert(![...letters, ...floats].some(other => physics.contact(other, b)));
      const edge = physics.bounds(b);
      assert(edge.left >= -0.001 && edge.right <= width + 0.001 && edge.top >= -0.001 && edge.bottom <= height + 0.001);
      floats.push(b);
    }
  }
});
