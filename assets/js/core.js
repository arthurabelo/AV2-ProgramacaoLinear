/* ==========================================================================
   core.js — utilitários compartilhados
   Navegação, canvas HiDPI, plot 2D, solver de PPL 2D e render 3D simples.
   Sem dependências externas.
   ========================================================================== */
(function (global) {
  'use strict';

  const PL = {};

  /* ---------------------------------------------------------------- utils */
  PL.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  PL.lerp = (a, b, t) => a + (b - a) * t;
  PL.round = (v, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };
  PL.fmt = (v, d = 2) => {
    if (!isFinite(v)) return '—';
    const r = PL.round(v, d);
    return Number.isInteger(r) ? String(r) : r.toFixed(d).replace(/\.?0+$/, '');
  };
  PL.nice = (v) => {
    // formata número para exibição em tabelas
    if (Math.abs(v) < 1e-10) return '0';
    const r = PL.round(v, 4);
    return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  };

  PL.isTouch = () => window.matchMedia('(pointer: coarse)').matches;

  /* ------------------------------------------------------------ navegação */
  const NAV = [
    {
      label: 'Comece aqui',
      items: [
        { id: 'index', num: '00', href: 'index.html', text: 'Visão geral & mapa da prova' },
        { id: 'resumo', num: '01', href: 'resumo.html', text: 'Formulário essencial' },
      ],
    },
    {
      label: 'Fundamentação teórica',
      items: [
        { id: 'convexos', num: '02', href: 'convexos.html', text: 'Conjuntos convexos' },
        { id: 'weierstrass', num: '03', href: 'teoremas.html', text: 'Teoremas & separação' },
      ],
    },
    {
      label: 'Métodos de solução',
      items: [
        { id: 'grafico', num: '04', href: 'grafico.html', text: 'Resolução gráfica 2D/3D' },
        { id: 'simplex', num: '05', href: 'simplex.html', text: 'Método Simplex' },
        { id: 'duasfases', num: '06', href: 'duasfases.html', text: 'M-Big & duas fases' },
        { id: 'sistemas', num: '07', href: 'sistemas.html', text: 'Sistemas lineares' },
      ],
    },
    {
      label: 'Treino',
      items: [
        { id: 'exercicios', num: '08', href: 'exercicios.html', text: 'Exercícios resolvidos' },
        { id: 'quiz', num: '09', href: 'quiz.html', text: 'Simulado interativo' },
      ],
    },
  ];
  PL.NAV = NAV;

  PL.pageId = () => (document.body.dataset.page || '');
  PL.pageIndex = () => {
    const flat = NAV.flatMap(g => g.items);
    const i = flat.findIndex(x => x.id === PL.pageId());
    return { flat, i };
  };

  PL.buildChrome = function () {
    const id = PL.pageId();
    const { flat, i } = PL.pageIndex();
    const cur = flat[i] || {};

    // sidebar
    const side = document.querySelector('.sidebar');
    if (side) {
      let html = `
        <a class="brand" href="index.html">
          <div class="brand-kicker">UFPI · Programação Linear</div>
          <div class="brand-title">Guia da 2ª Prova</div>
          <div class="brand-sub">Simplex, convexidade e gráfica</div>
        </a>`;
      NAV.forEach(g => {
        html += `<div class="nav-section"><div class="nav-label">${g.label}</div><div class="nav">`;
        g.items.forEach(it => {
          const active = it.id === id ? ' class="active"' : '';
          html += `<a href="${it.href}"${active}><span class="num">${it.num}</span><span>${it.text}</span></a>`;
        });
        html += `</div></div>`;
      });
      html += `
        <div class="side-foot">
          <b>Prova amanhã</b><br>
          Foque em: montar o tableau, achar a coluna que entra, a razão mínima, pivotear e ler a resposta.
          <br><br>
          <a href="index.html#checklist">Checklist de última hora →</a>
        </div>`;
      side.innerHTML = html;
    }

    // topbar
    const bar = document.querySelector('.topbar-inner');
    if (bar) {
      const total = flat.length;
      const pct = total ? Math.round(((i + 1) / total) * 100) : 0;
      bar.innerHTML = `
        <button class="menu-btn" id="menuBtn" aria-label="Abrir menu">☰</button>
        <div class="crumb">
          ${cur.num ? `<span>${cur.num}</span> · <b>${cur.text || ''}</b>` : '<b>Guia da 2ª Prova</b>'}
        </div>
        <div class="progress-wrap">
          <span>${i + 1}/${total}</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>`;
      const mb = document.getElementById('menuBtn');
      if (mb) {
        mb.addEventListener('click', () => {
          document.querySelector('.sidebar').classList.toggle('open');
        });
      }
    }

    // prev/next
    const nav = document.querySelector('.page-nav');
    if (nav && cur.id) {
      const prev = flat[i - 1], next = flat[i + 1];
      nav.innerHTML =
        (prev ? `<a href="${prev.href}" class="prev"><div class="dir">← Anterior</div><div class="ttl">${prev.text}</div></a>` : '<span></span>') +
        (next ? `<a href="${next.href}" class="next"><div class="dir">Próximo →</div><div class="ttl">${next.text}</div></a>` : '<span></span>');
    }

    // fecha sidebar mobile ao navegar
    document.querySelectorAll('.sidebar a').forEach(a => {
      a.addEventListener('click', () => document.querySelector('.sidebar')?.classList.remove('open'));
    });
  };

  /* --------------------------------------------------------- canvas HiDPI */
  /**
   * Prepara canvas com devicePixelRatio.
   * Retorna {ctx, W, H, dpr} em unidades CSS.
   */
  PL.fitCanvas = function (canvas, cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    // Largura: usa a do container (o canvas pode ter largura inline antiga).
    // O wrapper .canvas-wrap tem padding 0 e borda 1px.
    const wrap = canvas.parentElement;
    let availW = canvas.parentElement && canvas.parentElement.classList.contains('canvas-wrap')
      ? canvas.parentElement.clientWidth - 2
      : 0;
    if (!availW) availW = canvas.clientWidth || canvas.parentElement?.clientWidth || 600;

    // Altura: preferimos data-h (ou o style inline original), para manter a proporção
    // definida em cada página.
    let targetH = canvas.dataset.h ? +canvas.dataset.h : null;
    if (!targetH) {
      const inline = canvas.style.height;
      if (inline && inline.endsWith('px')) targetH = parseFloat(inline);
    }
    if (!targetH) targetH = Math.round(availW * 0.78);

    if (cssW == null) cssW = Math.max(120, Math.round(availW));
    if (cssH == null) cssH = Math.max(120, Math.round(targetH));

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W: cssW, H: cssH, dpr };
  };

  /* ------------------------------------------------------------- plot 2D */
  class Plot2D {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.o = Object.assign({
        xmin: -1, xmax: 6, ymin: -1, ymax: 6,
        pad: 44,
        grid: true,
        axes: true,
        equal: true,
      }, opts);
      this.resize();
    }

    resize() {
      const fit = PL.fitCanvas(this.canvas);
      this.ctx = fit.ctx; this.W = fit.W; this.H = fit.H;
      // área útil mantendo proporção (se equal)
      const pad = this.o.pad;
      const iw = this.W - pad * 2, ih = this.H - pad * 2;
      const ux = this.o.xmax - this.o.xmin, uy = this.o.ymax - this.o.ymin;
      if (this.o.equal) {
        const s = Math.min(iw / ux, ih / uy);
        this.sx = s; this.sy = s;
        this.cx0 = pad + (iw - ux * s) / 2;
        this.cy0 = pad + (ih - uy * s) / 2;
        this.cw = ux * s; this.ch = uy * s;
      } else {
        this.sx = iw / ux; this.sy = ih / uy;
        this.cx0 = pad; this.cy0 = pad; this.cw = iw; this.ch = ih;
      }
      return this;
    }

    x2p(x) { return this.cx0 + (x - this.o.xmin) * this.sx; }
    y2p(y) { return this.cy0 + this.ch - (y - this.o.ymin) * this.sy; }
    p2x(px) { return this.o.xmin + (px - this.cx0) / this.sx; }
    p2y(py) { return this.o.ymin + (this.cy0 + this.ch - py) / this.sy; }

    clear(bg = '#fdfdfb') {
      const { ctx, W, H } = this;
      ctx.clearRect(0, 0, W, H);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
      return this;
    }

    grid() {
      const { ctx } = this;
      const step = this.gridStep();
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ecebe4';
      for (let x = Math.ceil(this.o.xmin / step) * step; x <= this.o.xmax; x += step) {
        const px = Math.round(this.x2p(x)) + .5;
        ctx.beginPath(); ctx.moveTo(px, this.y2p(this.o.ymax)); ctx.lineTo(px, this.y2p(this.o.ymin)); ctx.stroke();
      }
      for (let y = Math.ceil(this.o.ymin / step) * step; y <= this.o.ymax; y += step) {
        const py = Math.round(this.y2p(y)) + .5;
        ctx.beginPath(); ctx.moveTo(this.x2p(this.o.xmin), py); ctx.lineTo(this.x2p(this.o.xmax), py); ctx.stroke();
      }
      ctx.restore();
      return this;
    }

    gridStep() {
      const target = 7;
      const raw = (this.o.xmax - this.o.xmin) / target;
      const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
      const n = raw / p;
      const m = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
      return m * p;
    }

    axes() {
      const { ctx } = this;
      const x0 = this.x2p(PL.clamp(0, this.o.xmin, this.o.xmax));
      const y0 = this.y2p(PL.clamp(0, this.o.ymin, this.o.ymax));
      ctx.save();
      ctx.strokeStyle = '#9aa5ad'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(this.x2p(this.o.xmin), y0); ctx.lineTo(this.x2p(this.o.xmax), y0);
      ctx.moveTo(x0, this.y2p(this.o.ymin)); ctx.lineTo(x0, this.y2p(this.o.ymax));
      ctx.stroke();
      // labels
      ctx.fillStyle = '#6b7680';
      ctx.font = '11px "JetBrains Mono", monospace';
      const step = this.gridStep();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = Math.ceil(this.o.xmin / step) * step; x <= this.o.xmax; x += step) {
        if (Math.abs(x) < 1e-9) continue;
        ctx.fillText(PL.fmt(x), this.x2p(x), y0 + 5);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = Math.ceil(this.o.ymin / step) * step; y <= this.o.ymax; y += step) {
        if (Math.abs(y) < 1e-9) continue;
        ctx.fillText(PL.fmt(y), x0 - 6, this.y2p(y));
      }
      ctx.restore();
      return this;
    }

    /** Desenha semiplano a·x + b·y (op) c dentro da janela, com clip */
    halfplane(a, b, c, opts = {}) {
      const { ctx, W, H } = this;
      const op = opts.op === '>=' ? '>=' : '<=';
      let poly = clipHalfplaneW(this.o.xmin, this.o.ymin, this.o.xmax, this.o.ymax, a, b, c, op);
      if (opts.op === '=') poly = [];
      if (poly.length < 3) return this;
      ctx.save();
      ctx.beginPath();
      poly.forEach(([x, y], k) => {
        const px = this.x2p(x), py = this.y2p(y);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = opts.fill || 'rgba(15,118,110,.10)';
      ctx.fill();
      if (opts.stroke !== false) {
        ctx.strokeStyle = opts.stroke || 'rgba(15,118,110,.45)';
        ctx.lineWidth = opts.lineWidth || 1;
        ctx.stroke();
      }
      ctx.restore();
      return this;
    }

    /** Reta a·x + b·y = c */
    line(a, b, c, opts = {}) {
      const { ctx } = this;
      const pts = [];
      const push = (x, y) => { if (x >= this.o.xmin - 1e-9 && x <= this.o.xmax + 1e-9 && y >= this.o.ymin - 1e-9 && y <= this.o.ymax + 1e-9) pts.push([x, y]); };
      if (Math.abs(b) > 1e-9) {
        push(this.o.xmin, (c - a * this.o.xmin) / b);
        push(this.o.xmax, (c - a * this.o.xmax) / b);
      }
      if (Math.abs(a) > 1e-9) {
        push((c - b * this.o.ymin) / a, this.o.ymin);
        push((c - b * this.o.ymax) / a, this.o.ymax);
      }
      const uniq = [];
      pts.forEach(p => {
        if (!uniq.some(q => Math.abs(q[0] - p[0]) < 1e-7 && Math.abs(q[1] - p[1]) < 1e-7)) uniq.push(p);
      });
      if (uniq.length < 2) return this;
      ctx.save();
      ctx.strokeStyle = opts.color || '#0f766e';
      ctx.lineWidth = opts.width || 2;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      uniq.forEach(([x, y], k) => {
        const px = this.x2p(x), py = this.y2p(y);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
      return this;
    }

    polygon(points, opts = {}) {
      const { ctx } = this;
      if (!points.length) return this;
      ctx.save();
      ctx.beginPath();
      points.forEach(([x, y], k) => {
        const px = this.x2p(x), py = this.y2p(y);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath();
      if (opts.fill) { ctx.fillStyle = opts.fill; ctx.fill(); }
      if (opts.stroke || opts.stroke === undefined) {
        ctx.strokeStyle = opts.stroke || '#0f766e';
        ctx.lineWidth = opts.width || 2;
        if (opts.dash) ctx.setLineDash(opts.dash);
        ctx.stroke();
      }
      ctx.restore();
      return this;
    }

    point(x, y, opts = {}) {
      const { ctx } = this;
      const px = this.x2p(x), py = this.y2p(y);
      ctx.save();
      if (opts.halo !== false) {
        ctx.beginPath();
        ctx.arc(px, py, (opts.r || 4) + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253,253,251,.85)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(px, py, opts.r || 4, 0, Math.PI * 2);
      ctx.fillStyle = opts.color || '#0f766e';
      ctx.fill();
      if (opts.ring) {
        ctx.strokeStyle = opts.ring;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
      if (opts.label) {
        ctx.save();
        ctx.fillStyle = opts.labelColor || '#101418';
        ctx.font = `${opts.labelWeight || 600} ${opts.labelSize || 12}px "Inter", sans-serif`;
        ctx.textAlign = opts.labelDx < 0 ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.label, px + (opts.labelDx ?? 8), py + (opts.labelDy ?? -9));
        ctx.restore();
      }
      return this;
    }

    segment(x1, y1, x2, y2, opts = {}) {
      const { ctx } = this;
      ctx.save();
      ctx.strokeStyle = opts.color || '#b45309';
      ctx.lineWidth = opts.width || 2;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      ctx.moveTo(this.x2p(x1), this.y2p(y1));
      ctx.lineTo(this.x2p(x2), this.y2p(y2));
      ctx.stroke();
      ctx.restore();
      return this;
    }

    arrow(x1, y1, x2, y2, opts = {}) {
      const { ctx } = this;
      const p1 = [this.x2p(x1), this.y2p(y1)], p2 = [this.x2p(x2), this.y2p(y2)];
      const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      const head = opts.head || 8;
      ctx.save();
      ctx.strokeStyle = opts.color || '#b45309';
      ctx.fillStyle = opts.color || '#b45309';
      ctx.lineWidth = opts.width || 2;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p2[0], p2[1]);
      ctx.lineTo(p2[0] - head * Math.cos(ang - 0.4), p2[1] - head * Math.sin(ang - 0.4));
      ctx.lineTo(p2[0] - head * Math.cos(ang + 0.4), p2[1] - head * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.restore();
      return this;
    }

    text(x, y, str, opts = {}) {
      const { ctx } = this;
      ctx.save();
      ctx.fillStyle = opts.color || '#101418';
      ctx.font = `${opts.weight || 500} ${opts.size || 12}px "Inter", sans-serif`;
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'middle';
      ctx.fillText(str, this.x2p(x) + (opts.dx || 0), this.y2p(y) + (opts.dy || 0));
      ctx.restore();
      return this;
    }
  }

  PL.Plot2D = Plot2D;

  /* --------------------------------------------------- geometria / corte */
  /** Recorta retângulo por a·x+b·y (op) c. Retorna polígono (Sutherland–Hodgman). */
  function clipHalfplaneW(xmin, ymin, xmax, ymax, a, b, c, op) {
    let poly = [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax]];
    const eps = 1e-9;
    const inside = (p) => {
      const v = a * p[0] + b * p[1] - c;
      return op === '<=' ? v <= eps : v >= -eps;
    };
    const inter = (p, q) => {
      const v1 = a * p[0] + b * p[1] - c;
      const v2 = a * q[0] + b * q[1] - c;
      const t = v1 / (v1 - v2);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const cur = poly[k], prev = poly[(k + poly.length - 1) % poly.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci) {
        if (!pi) out.push(inter(prev, cur));
        out.push(cur);
      } else if (pi) {
        out.push(inter(prev, cur));
      }
    }
    return out;
  }
  PL.clipHalfplaneW = clipHalfplaneW;

  /** Interseção de retas a1x+b1y=c1 e a2x+b2y=c2 (null se paralelas) */
  function intersectLines(a1, b1, c1, a2, b2, c2) {
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) return null;
    return [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
  }
  PL.intersectLines = intersectLines;

  /* ----------------------------------------------------------- solver 2D */
  /**
   * Resolve PPL 2D:
   *   constraints: [{a,b,c,op:'<='|'>='|'='}]  a·x+b·y (op) c
   *   sense: 'max'|'min'; obj: [c1,c2]
   * Retorna {vertices:[{x,y,z}], feasible:bool, optimum:{x,y,z}|null,
   *          unbounded:bool, edges:[[i,j]]}
   */
  PL.solveLP2D = function (constraints, obj, sense = 'max', bounds = { xmin: 0, ymin: 0, xmax: 1e6, ymax: 1e6 }) {
    const EPS = 1e-7;
    const ineqs = constraints.map(k => ({ ...k }));
    // não-negatividade implícita
    if (!bounds.noNonNeg) {
      ineqs.push({ a: -1, b: 0, c: 0, op: '<=', implicit: true });
      ineqs.push({ a: 0, b: -1, c: 0, op: '<=', implicit: true });
    }
    const lines = ineqs.map(k => ({ a: k.a, b: k.b, c: k.c, op: k.op, ref: k }));

    const cand = [];
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const p = intersectLines(lines[i].a, lines[i].b, lines[i].c, lines[j].a, lines[j].b, lines[j].c);
        if (p && isFinite(p[0]) && isFinite(p[1])) cand.push(p);
      }
    }
    // dedup
    const uniq = [];
    cand.forEach(p => {
      if (!uniq.some(q => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) uniq.push(p);
    });

    const feasible = (p) => {
      for (const k of ineqs) {
        const v = k.a * p[0] + k.b * p[1];
        if (k.op === '<=' && v > k.c + 1e-6) return false;
        if (k.op === '>=' && v < k.c - 1e-6) return false;
        if (k.op === '=' && Math.abs(v - k.c) > 1e-6) return false;
      }
      return true;
    };

    let verts = uniq.filter(feasible);
    // remove quase-duplicados
    const v2 = [];
    verts.forEach(p => {
      if (!v2.some(q => Math.abs(q[0]-p[0])<1e-6 && Math.abs(q[1]-p[1])<1e-6)) v2.push(p);
    });
    verts = v2;

    if (verts.length === 0) {
      return { vertices: [], feasible: false, optimum: null, unbounded: false, edges: [], hull: [] };
    }

    const z = (p) => obj[0] * p[0] + obj[1] * p[1];
    let best = verts[0], second = null;
    for (const p of verts) {
      const zp = z(p);
      const zb = z(best);
      if ((sense === 'max' && zp > zb + 1e-9) || (sense === 'min' && zp < zb - 1e-9)) { best = p; }
    }
    const bestZ = z(best);
    const ties = verts.filter(p => Math.abs(z(p) - bestZ) < 1e-7);
    if (ties.length > 1) second = ties.find(p => Math.abs(p[0]-best[0])>1e-7 || Math.abs(p[1]-best[1])>1e-7);

    const vertsObj = verts.map(p => ({ x: p[0], y: p[1], z: z(p) }));

    // hull (Andrew monotone chain) para desenhar região
    const hull = convexHull(verts.slice());

    // detectar ilimitado: região não limitada se obj pode crescer ao longo de direção
    let unbounded = false;
    for (const k of ineqs) {
      // raios nas direções das retas de fronteira
    }
    // teste simples: se o hull encosta na "janela grande", tratamos fora do plot.
    const big = 1e5;
    if (hull.some(p => Math.abs(p[0]) > big || Math.abs(p[1]) > big)) unbounded = true;

    return {
      vertices: vertsObj,
      hull,
      feasible: true,
      optimum: { x: best[0], y: best[1], z: bestZ },
      multiple: ties.length > 1,
      second: second ? { x: second[0], y: second[1], z: z(second) } : null,
      unbounded,
      objective: z,
    };
  };

  function convexHull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length <= 2) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let k = pts.length - 1; k >= 0; k--) {
      const p = pts[k];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  PL.convexHull = convexHull;

  /** Ponto em polígono (ray casting) */
  PL.pointInPoly = function (p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };

  /* --------------------------------------------------------------- RNG */
  // deterministic-ish for demos
  PL.rand = function (seed) {
    let s = seed || 12345;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  };

  /* ----------------------------------------------------------- render 3D */
  /**
   * Renderizador 3D mínimo (rotação + projeção perspectiva + painter's).
   * malha: { vertices:[[x,y,z]], faces:[{idx:[...], fill, stroke, opacity}], edges:[[i,j]] }
   */
  class Render3D {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.o = Object.assign({ rotX: -0.55, rotZ: 0.7, dist: 6.5, fov: 1.9, scale: 1 }, opts);
      this.resize();
    }
    resize() {
      const fit = PL.fitCanvas(this.canvas);
      this.ctx = fit.ctx; this.W = fit.W; this.H = fit.H;
      return this;
    }
    project(v, center) {
      const [x, y, z] = [v[0] - center[0], v[1] - center[1], v[2] - center[2]];
      const cz = Math.cos(this.o.rotZ), sz = Math.sin(this.o.rotZ);
      let X = x * cz - y * sz;
      let Y = x * sz + y * cz;
      let Z = z;
      const cx = Math.cos(this.o.rotX), sx = Math.sin(this.o.rotX);
      const Y2 = Y * cx - Z * sx;
      const Z2 = Y * sx + Z * cx;
      const d = this.o.dist;
      const f = (this.o.fov * Math.min(this.W, this.H)) / (d + Z2 * this.o.scale);
      return {
        x: this.W / 2 + X * f * this.o.scale,
        y: this.H / 2 - Y2 * f * this.o.scale,
        depth: Z2,
      };
    }
    clear() {
      this.ctx.clearRect(0, 0, this.W, this.H);
      this.ctx.fillStyle = '#fdfdfb';
      this.ctx.fillRect(0, 0, this.W, this.H);
      return this;
    }
    draw(mesh, center = [0, 0, 0]) {
      const { ctx } = this;
      const P = mesh.vertices.map(v => this.project(v, center));
      const faces = (mesh.faces || []).map(f => {
        const cyc = f.idx.reduce((s, i) => s + P[i].depth, 0) / f.idx.length;
        const pts = f.idx.map(i => P[i]);
        return { f, cyc, pts };
      }).sort((a, b) => b.cyc - a.cyc);
      faces.forEach(({ f, pts }) => {
        ctx.beginPath();
        pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        if (f.fill) { ctx.fillStyle = f.fill; ctx.fill(); }
        if (f.stroke) {
          ctx.strokeStyle = f.stroke;
          ctx.lineWidth = f.width || 1.2;
          if (f.dash) ctx.setLineDash(f.dash); else ctx.setLineDash([]);
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);
      if (mesh.edges) {
        ctx.strokeStyle = mesh.edgeColor || '#0f766e';
        ctx.lineWidth = mesh.edgeWidth || 1.6;
        ctx.beginPath();
        mesh.edges.forEach(([i, j]) => {
          ctx.moveTo(P[i].x, P[i].y);
          ctx.lineTo(P[j].x, P[j].y);
        });
        ctx.stroke();
      }
      if (mesh.points) {
        mesh.points.forEach(pt => {
          const p = this.project(pt.v, center);
          ctx.beginPath();
          ctx.arc(p.x, p.y, pt.r || 4, 0, Math.PI * 2);
          ctx.fillStyle = pt.color || '#b45309';
          ctx.fill();
          if (pt.label) {
            ctx.fillStyle = '#101418';
            ctx.font = '600 12px Inter, sans-serif';
            ctx.fillText(pt.label, p.x + 7, p.y - 6);
          }
        });
      }
      return P;
    }
    axis(center = [0, 0, 0], len = 4) {
      const { ctx } = this;
      const o = this.project(center, center);
      const axes = [
        { v: [len, 0, 0], c: '#b42318', l: 'x₁' },
        { v: [0, len, 0], c: '#15803d', l: 'x₂' },
        { v: [0, 0, len], c: '#1d4ed8', l: 'x₃' },
      ];
      axes.forEach(({ v, c, l }) => {
        const p = this.project([center[0] + v[0], center[1] + v[1], center[2] + v[2]], center);
        ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillText(l, p.x + 5, p.y - 4);
      });
      return this;
    }
  }
  PL.Render3D = Render3D;

  /* ------------------------------------------------------ rotação pointer */
  PL.enableOrbit = function (canvas, r3d, onChange) {
    let dragging = false, lx = 0, ly = 0;
    const down = (e) => {
      dragging = true;
      const t = e.touches ? e.touches[0] : e;
      lx = t.clientX; ly = t.clientY;
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - lx, dy = t.clientY - ly;
      lx = t.clientX; ly = t.clientY;
      r3d.o.rotZ += dx * 0.008;
      r3d.o.rotX = PL.clamp(r3d.o.rotX + dy * 0.008, -1.5, 1.5);
      onChange && onChange();
      e.preventDefault();
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);
  };

  /* ------------------------------------------------------------- storage */
  PL.progress = {
    get() {
      try { return JSON.parse(localStorage.getItem('pl_progress') || '{}'); } catch (e) { return {}; }
    },
    set(id, val) {
      const p = this.get(); p[id] = val;
      try { localStorage.setItem('pl_progress', JSON.stringify(p)); } catch (e) {}
    },
    mark(id) { this.set(id, true); },
  };

  /* ------------------------------------------------------------ boot */
  PL.boot = function () {
    PL.buildChrome();
    // realce do item ativo já feito no chrome
    window.addEventListener('resize', () => {
      document.querySelectorAll('canvas[data-autofit]').forEach(c => {
        if (c._rerender) c._rerender();
      });
    });
  };

  global.PL = PL;
})(window);
