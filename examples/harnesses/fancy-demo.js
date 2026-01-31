// Particle Overlay Demo — dogfooding harness for chrome-debug-repl
// Inject onto any page: chrome-debug inject fancy-demo
// API: FX.burst(50), FX.clear(), FX.toggle(), FX.stop(), FX.start(), FX.remove()
;(function () {
  'use strict';

  // Idempotent: tear down previous instance before rebuilding
  if (window.FancyDemo && typeof window.FancyDemo.remove === 'function') {
    window.FancyDemo.remove();
  }

  // --- Configuration ---
  var config = {
    colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
    maxParticles: 200,
    spawnRate: 2,         // particles per frame
    minSize: 2,
    maxSize: 6,
    minSpeed: 0.3,
    maxSpeed: 1.5,
    fadeRate: 0.005,
    gravity: 0.02,
  };

  // --- State ---
  var particles = [];
  var canvas, ctx;
  var animFrameId = null;
  var running = true;
  var visible = true;

  // --- Canvas setup ---
  canvas = document.createElement('canvas');
  canvas.id = '__fancy-demo-canvas__';
  canvas.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:100vw',
    'height:100vh',
    'pointer-events:none',
    'z-index:2147483647',
  ].join(';');
  document.body.appendChild(canvas);

  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // --- Particle ---
  function randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function pickColor() {
    return config.colors[Math.floor(Math.random() * config.colors.length)];
  }

  function createParticle(x, y) {
    var angle = Math.random() * Math.PI * 2;
    var speed = randomBetween(config.minSpeed, config.maxSpeed);
    return {
      x: x !== undefined ? x : Math.random() * canvas.width,
      y: y !== undefined ? y : Math.random() * canvas.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: randomBetween(config.minSize, config.maxSize),
      color: pickColor(),
      alpha: 1,
    };
  }

  function updateParticle(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += config.gravity;
    p.alpha -= config.fadeRate;
  }

  function drawParticle(p) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Animation loop ---
  function frame() {
    if (!running) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawn ambient particles
    for (var s = 0; s < config.spawnRate; s++) {
      if (particles.length < config.maxParticles) {
        particles.push(createParticle());
      }
    }

    // Update and draw
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      updateParticle(p);
      if (p.alpha <= 0) {
        particles.splice(i, 1);
      } else {
        drawParticle(p);
      }
    }

    ctx.globalAlpha = 1;
    animFrameId = requestAnimationFrame(frame);
  }

  frame();

  // --- Public API ---
  var api = {
    burst: function (n) {
      n = n || 30;
      var cx = canvas.width / 2;
      var cy = canvas.height / 2;
      for (var i = 0; i < n; i++) {
        particles.push(createParticle(cx, cy));
      }
    },

    clear: function () {
      particles.length = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    setColors: function (arr) {
      if (Array.isArray(arr) && arr.length > 0) {
        config.colors = arr;
      }
    },

    toggle: function () {
      visible = !visible;
      canvas.style.display = visible ? '' : 'none';
    },

    stop: function () {
      running = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    },

    start: function () {
      if (!running) {
        running = true;
        frame();
      }
    },

    remove: function () {
      api.stop();
      particles.length = 0;
      window.removeEventListener('resize', resizeCanvas);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      delete window.FancyDemo;
      delete window.FX;
    },
  };

  window.FancyDemo = api;
  window.FX = api;

  console.log('[FancyDemo] Particle overlay loaded. Try: FX.burst(50)');
})();
