(function (root, factory) {
  const physics = factory();
  if (typeof module === "object" && module.exports) module.exports = physics;
  else root.PoolPhysics = physics;
})(globalThis, function () {
  "use strict";
  const RAD = Math.PI / 180;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const visualScale = (body) => Math.max(0, 1 - body.z + 0.09 * clamp(body.wave || 0, -1.5, 1.5));
  // Reserve the full footprint during a dunk or entrance, and follow any overshoot.
  const collisionScale = (body) => Math.max(1, visualScale(body));

  function letterBox(ch, width, height, em) {
    const stroke = em * 0.02 + 2;
    const top = ("amo".includes(ch) ? 0.27 : 0.02) * height - height / 2 - stroke;
    const bottom = height * 0.48 + stroke;
    return { x: 0, y: (top + bottom) / 2, hw: width / 2 + stroke, hh: (bottom - top) / 2 };
  }

  function radius(body) {
    const circles = Math.max(...body.circles.map((p) => Math.hypot(p.x, p.y) + p.rad));
    return body.box ? Math.max(circles, Math.hypot(Math.abs(body.box.x) + body.box.hw, Math.abs(body.box.y) + body.box.hh)) : circles;
  }

  function worldCircle(body, part, scale, c, s) {
    return { x: body.x + scale * (part.x * c - part.y * s), y: body.y + scale * (part.x * s + part.y * c), rad: part.rad * scale };
  }

  function circleBox(boxBody, circle) {
    const box = boxBody.box, scale = collisionScale(boxBody), c = Math.cos(boxBody.r * RAD), s = Math.sin(boxBody.r * RAD);
    const dx = circle.x - boxBody.x, dy = circle.y - boxBody.y;
    const x = dx * c + dy * s - box.x * scale, y = -dx * s + dy * c - box.y * scale;
    const hw = box.hw * scale, hh = box.hh * scale;
    let px = clamp(x, -hw, hw), py = clamp(y, -hh, hh);
    const ox = x - px, oy = y - py, distance = Math.hypot(ox, oy);
    let nx, ny, depth;
    if (distance > 0) {
      depth = circle.rad - distance;
      if (depth <= 0) return null;
      nx = ox / distance; ny = oy / distance;
    } else {
      // An embedded float exits through the nearest edge, including an exact centre spawn.
      const horizontal = hw - Math.abs(x), vertical = hh - Math.abs(y);
      if (horizontal < vertical) { nx = x < 0 ? -1 : 1; ny = 0; px = nx * hw; depth = circle.rad + horizontal; }
      else { nx = 0; ny = y < 0 ? -1 : 1; py = ny * hh; depth = circle.rad + vertical; }
    }
    px += box.x * scale; py += box.y * scale;
    return { nx: nx * c - ny * s, ny: nx * s + ny * c, depth,
      x: boxBody.x + px * c - py * s, y: boxBody.y + px * s + py * c };
  }

  function contact(a, b) {
    const as = collisionScale(a), bs = collisionScale(b);
    if (Math.hypot(b.x - a.x, b.y - a.y) > a.size * as + b.size * bs) return null;
    const ac = Math.cos(a.r * RAD), an = Math.sin(a.r * RAD), bc = Math.cos(b.r * RAD), bn = Math.sin(b.r * RAD);
    let hit = null;
    // Keep letter-to-letter contacts soft; floats see a solid outline, including the counters.
    if (!!a.box !== !!b.box) {
      const box = a.box ? a : b, float = a.box ? b : a, sign = a.box ? 1 : -1;
      const fs = a.box ? bs : as, fc = a.box ? bc : ac, fn = a.box ? bn : an;
      for (const part of float.circles) {
        const candidate = circleBox(box, worldCircle(float, part, fs, fc, fn));
        if (candidate && (!hit || candidate.depth > hit.depth)) hit = { ...candidate, nx: candidate.nx * sign, ny: candidate.ny * sign };
      }
    } else {
      for (const p of a.circles) {
        const ap = worldCircle(a, p, as, ac, an);
        for (const q of b.circles) {
          const bp = worldCircle(b, q, bs, bc, bn), dx = bp.x - ap.x, dy = bp.y - ap.y;
          const distance = Math.hypot(dx, dy), depth = ap.rad + bp.rad - distance;
          if (depth <= 0 || (hit && depth <= hit.depth)) continue;
          const nx = distance > 0.0001 ? dx / distance : 1, ny = distance > 0.0001 ? dy / distance : 0;
          hit = { nx, ny, depth, x: ap.x + nx * ap.rad, y: ap.y + ny * ap.rad };
        }
      }
    }
    return hit;
  }

  function bounds(body) {
    const scale = collisionScale(body), c = Math.cos(body.r * RAD), s = Math.sin(body.r * RAD);
    const circles = body.circles.map((p) => worldCircle(body, p, scale, c, s));
    return {
      left: Math.min(...circles.map((p) => p.x - p.rad)), right: Math.max(...circles.map((p) => p.x + p.rad)),
      top: Math.min(...circles.map((p) => p.y - p.rad)), bottom: Math.max(...circles.map((p) => p.y + p.rad)),
    };
  }

  function settle(body, obstacles, width, height) {
    const preferred = { x: body.x, y: body.y };
    const inside = () => {
      const r = bounds(body);
      body.x += Math.max(0, -r.left) + Math.min(0, width - r.right);
      body.y += Math.max(0, -r.top) + Math.min(0, height - r.bottom);
    };
    const clear = () => !obstacles.some((other) => contact(other, body));
    inside();
    for (let pass = 0; pass < 20; pass++) {
      if (clear()) return true;
      for (const other of obstacles) {
        const hit = contact(other, body);
        if (hit) { body.x += hit.nx * (hit.depth + 1); body.y += hit.ny * (hit.depth + 1); }
      }
      inside();
    }
    // A narrow gap can trap iterative separation. Find the nearest open patch of paint.
    const fallback = { x: body.x, y: body.y }, step = Math.max(12, body.size * 0.5);
    let best = null, distance = Infinity;
    for (let y = 0; y <= height + step; y += step) {
      for (let x = 0; x <= width + step; x += step) {
        body.x = x; body.y = y; inside();
        const d = Math.hypot(body.x - preferred.x, body.y - preferred.y);
        if (d < distance && clear()) { best = { x: body.x, y: body.y }; distance = d; }
      }
    }
    Object.assign(body, best || fallback);
    return !!best;
  }

  return { visualScale, collisionScale, letterBox, radius, contact, bounds, settle };
});
