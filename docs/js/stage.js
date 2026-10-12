// 히어로 하단 연출: 주인공과 몬스터들이 돌아다니고 서로 싸웁니다.
// 몹·주인공 클릭 = 피격, 몹을 쓰러뜨리면 영혼불 +1 / 주인공이 맞으면 -1,
// 영혼불 3개 이상일 때 빈 곳을 꾹 눌렀다 떼면 강화공격 (게임과 같은 규칙)
// 스프라이트 정보는 sprites.js (tools/make_sprites.py 로 생성)
(() => {
  const S = window.SPRITES;
  const stage = document.getElementById('stage');
  if (!S || !stage) return;

  const lite = document.documentElement.classList.contains('lite');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let K = 1; // 화면 배율 (CSS --k)
  let W = 0; // 무대 폭(px)
  const measure = () => {
    K = parseFloat(getComputedStyle(stage).getPropertyValue('--k')) || 1;
    W = stage.clientWidth;
  };
  measure();

  const HP = { bug: 3, fairy: 2, spirit: 2, bigbug: 8, golem: 6, hive: 5 }; // 몇 번 클릭하면 쓰러지는지 (주인공은 아래 PLAYER_HP)

  class Actor {
    // keep: 쓰러져도 10초 뒤 다시 나타나는 고정·배경 몹
    constructor(name, x, { y = 0, face = 1, start, keep = false } = {}) {
      this.d = S[name];
      this.name = name; this.keep = keep;
      this.x = x; this.y = y; this.face = face;
      this.el = document.createElement('i');
      this.el.actor = this; // 강화공격 범위 판정용
      this.el.className = 'actor' + (['golem', 'hive', 'bug'].includes(name) ? ' smooth' : '');
      stage.append(this.el);
      this.el.style.backgroundImage = `url(${this.d.src})`; // 모든 동작이 한 장(격자)에 있어 동작이 바뀌어도 이미지는 그대로
      this.cur = [start || (this.d.idle ? 'idle' : 'fly'), false];
      if (HP[name]) {
        this.hp = HP[name];
        this.el.classList.add('mob');
        this.clickable((e) => this.damage(e));
      }
      this.layout();
    }
    // 클릭 판정은 기준 프레임의 몸통 상자만 — 투명한 여백(꼬리 휘두르는 자리 등)이 뒤 캐릭터의 클릭을 가로채지 않게
    clickable(fn) {
      this.hb = document.createElement('b');
      this.hb.className = 'hb';
      this.el.append(this.hb);
      this.hb.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }); // preventDefault: 연타해도 글자가 선택되지 않게
    }
    // 크기·기준점 계산 (화면 배율이 바뀌면 다시 호출)
    layout() {
      if (this.dead) return; // 다시 나타날 때 호출됨
      const e = this.el.style;
      e.bottom = 6 - this.d.foot * K + 'px';
      e.transformOrigin = this.d.ax * K + 'px 100%';
      if (this.hb) { const [x, y, w, h] = this.d.hb; Object.assign(this.hb.style, { left: x * K + 'px', top: y * K + 'px', width: w * K + 'px', height: h * K + 'px' }); }
      this.play(...this.cur);
      this.put();
      void this.el.offsetWidth; // 시작 위치를 확정해야 첫 move 가 화면 밖에서 미끄러져 들어온다
    }
    put() {
      this.el.style.transform = `translate(${this.x - this.d.ax * K}px,${-this.y}px) scaleX(${this.face})`;
    }
    // 동작 재생. a.f(격자 안 프레임 번호)를 a.d(초)만큼씩 보여 준다 — Unity 애니메이션과 같은 타이밍.
    // once=true 면 마지막 프레임에서 멈춘다. 끝나는 시점에 풀리는 Promise 반환
    play(anim, once = false) {
      this.live();
      const d = this.d, a = d[anim], e = this.el, w = d.w * K, h = d.h * K;
      const at = (f) => `${-(f % d.cols) * w}px ${-Math.floor(f / d.cols) * h}px`;
      const T = a.d.reduce((s, x) => s + x, 0);
      this.cur = [anim, once];
      this.anim?.cancel();
      Object.assign(e.style, { width: w + 'px', height: h + 'px', backgroundSize: `${d.cols * w}px ${d.rows * h}px`, backgroundPosition: at(a.f[0]) });
      if (a.f.length > 1 && !lite) {
        let t = 0;
        const kf = a.f.map((f, i) => {
          const k = { offset: t / T, backgroundPosition: at(f), easing: 'step-end' };
          t += a.d[i];
          return k;
        });
        kf.push({ offset: 1, backgroundPosition: kf.at(-1).backgroundPosition });
        this.anim = e.animate(kf, { duration: T * 1000, iterations: once ? 1 : Infinity, fill: 'forwards' });
      }
      return sleep(T * 1000);
    }
    turn(f) {
      this.live();
      if (f === this.face) return;
      this.el.style.transition = 'opacity .5s'; // 방향 전환은 즉시
      this.face = f;
      this.put();
      void this.el.offsetWidth;
    }
    async move(x, speed, y = this.y) {
      this.live();
      const d = Math.max(Math.hypot(x - this.x, y - this.y) / (speed * K), 0.01);
      this.el.style.transition = `transform ${d}s linear, opacity .5s`;
      this.x = x; this.y = y;
      this.put();
      await sleep(d * 1000);
    }
    hit() { // 피격 반짝임
      this.live();
      this.el.classList.add('hit');
      setTimeout(() => this.el.classList.remove('hit'), 160);
    }
    live() { if (this.dead) throw new Error('dead'); } // 쓰러진 몹을 장면이 계속 쓰려 하면 그 장면을 끝낸다 (장면 실행부의 catch 가 정리)
    // 피격(e: 클릭 위치, 없으면 몸 중앙에 불꽃): 체력이 다하면 사라지며 영혼불 +1, keep 이면 10초 뒤 다시 나타난다
    damage(e, n = 1) {
      if (this.dead) return;
      e ? sparkAt(e) : spark(this.x, this.y + (this.d.h / 2 - this.d.foot) * K);
      this.hit();
      if ((this.hp -= n) > 0) return;
      this.dead = true;
      addSoul();
      this.el.style.opacity = 0;
      if (!this.keep) return void setTimeout(() => this.el.remove(), 550);
      setTimeout(() => { this.dead = false; this.hp = HP[this.name]; this.layout(); this.el.style.opacity = ''; }, 10000);
    }
    async vanish() {
      this.dead = true; // 사라지는 중에는 클릭돼도 영혼불을 주지 않게
      this.el.style.opacity = 0;
      await sleep(550);
      this.el.remove();
    }
  }

  const spark = (x, y) => {
    const s = document.createElement('i');
    s.className = 'spark';
    s.style.cssText = `left:${x}px;bottom:${6 + y}px`;
    stage.append(s);
    setTimeout(() => s.remove(), 500);
  };
  const fxAt = (x, y) => { // 효과를 담을 빈 상자 (무대 기준 x, 바닥에서 y)
    const b = document.createElement('b');
    b.className = 'fx';
    b.style.cssText = `left:${x}px;bottom:${6 + y}px`;
    stage.append(b);
    return b;
  };
  // 몸통 중심 (무대 기준 x, 바닥에서 y)
  const mid = (a) => [a.x, a.y + (a.d.h - a.d.foot - a.d.hb[1] - a.d.hb[3] / 2) * K];
  const sparkAt = (e) => { const r = stage.getBoundingClientRect(); spark(e.clientX - r.left, r.bottom - e.clientY - 6); };

  // ── 등장인물 ──────────────────────────────────────────
  const hiveX = 0.1, golemX = 0.86; // 고정 몬스터 위치(폭 비율)
  const showGolem = () => W >= 560;
  const me = new Actor('player', W * 0.5);
  // 장면은 P 로, 사용자 조작(쓰러짐·강공격)은 me 로 주인공을 움직인다.
  // 사용자 조작이 시작되면 cut 이 바뀌어, 그 전에 돌던 장면이 P 의 메서드를 쓰는 순간 예외 → 장면이 끝난다 (장면 실행부의 catch 가 정리)
  let cut = 0, sceneCut = 0;
  const P = new Proxy(me, { get(t, k) {
    const v = t[k];
    if (typeof v !== 'function') return v;
    if (sceneCut !== cut) throw new Error('cut');
    return v.bind(t);
  } });
  const H = new Actor('hive', W * hiveX, { keep: true });
  const G = showGolem() ? new Actor('golem', W * golemX, { face: -1, keep: true }) : null;

  const ambient = []; // 장면과 무관하게 떠다니는 캐릭터 (아래에서 채움)

  let inView = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(stage.parentElement);

  // ── 영혼불 (게임 SoulFireManager · FX_SoulFire 와 같은 규칙) ─────────
  // 최대 7개가 머리 위 190° 부채꼴로 늘어선다. 반지름 1.5 + 0.2×(개수-1) 유닛, 새 자리로는 초당 12유닛으로 이동.
  // 소모·자연 감소는 오래된 것부터. 마지막 획득·소모 30초 뒤부터 10초마다 하나씩 사라진다.
  // 1유닛 크기와 부채꼴 중심은 게임 영상에서 잰 값 (1유닛 = 주인공 키 × 0.31, 중심 = 발 위로 키 × 0.65)
  const fires = []; // 오래된 것부터
  const layer = document.createElement('b');
  layer.className = 'souls';
  me.el.append(layer);
  const unit = () => 0.31 * me.d.hb[3] * K;
  let lastSoul = 0, lastDecay = 0, decaying = false;
  const arrange = () => {
    const n = fires.length, u = unit(), r = (1.5 + 0.2 * (n - 1)) * u;
    Object.assign(layer.style, { left: me.d.ax * K + 'px', bottom: (me.d.foot + 0.65 * me.d.hb[3]) * K + 'px' });
    fires.forEach((f, i) => {
      const a = (90 + (n === 1 ? 0 : -95 + (190 * i) / (n - 1))) * Math.PI / 180;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      f.el.style.transition = `transform ${Math.hypot(x - f.x, y - f.y) / (12 * u)}s linear`;
      f.x = x; f.y = y;
      f.el.style.transform = `translate(${x}px,${-y}px)`;
    });
  };
  // 불꽃 파티클 하나: 0.7~2초 동안 플립북 20장을 한 번 재생, 크기 0 → 0.73(25%) → 1, 71% 이후 흐려짐
  const flame = (f) => {
    if (!lite && (!inView || document.hidden)) return;
    const u = unit(), w = rnd(1.4, 2.8) * u, h = rnd(1.6, 2.4) * u, life = rnd(700, 2000);
    const p = document.createElement('i');
    p.style.cssText = `width:${w}px;height:${h}px;left:${rnd(-0.14, 0.14) * u - w / 2}px;top:${rnd(-0.08, 0.08) * u - h / 2}px;background-size:${20 * w}px ${h}px`;
    f.el.append(p);
    if (lite) return void (p.style.backgroundPositionX = -8 * w + 'px'); // 모션 줄이기: 한 장면만
    p.animate({ backgroundPositionX: ['0px', -20 * w + 'px'] }, { duration: life, easing: 'steps(20)' });
    p.animate([{ transform: 'scale(0)' }, { transform: 'scale(.73)', offset: 0.25 }, { opacity: 1, offset: 0.71 }, { transform: 'scale(1)', opacity: 0 }], { duration: life }).onfinish = () => p.remove();
  };
  const addSoul = () => {
    if (fires.length >= 7) return;
    const f = { el: document.createElement('b'), x: 0, y: 0 }; // 부채꼴 중심에서 생겨 자기 자리로 날아간다
    layer.append(f.el);
    flame(f);
    if (!lite) f.timer = setInterval(() => flame(f), 333); // 초당 3개
    fires.push(f);
    lastSoul = Date.now(); decaying = false;
    void f.el.offsetWidth;
    arrange();
  };
  const dropSouls = (n, spent = true) => { // spent: 흡수(소모)면 감소 대기 시간을 다시 잰다
    const k = Math.min(n, fires.length);
    for (const f of fires.splice(0, k)) { clearInterval(f.timer); f.el.remove(); }
    if (k && spent) { lastSoul = Date.now(); decaying = false; }
    arrange();
    return k;
  };
  setInterval(() => { // 자연 감소
    const now = Date.now();
    if (!fires.length || now - lastSoul < 30000 || (decaying && now - lastDecay < 10000)) return;
    dropSouls(1, false);
    decaying = true; lastDecay = now;
  }, 1000);
  arrange();

  addEventListener('resize', () => {
    measure();
    me.x = Math.min(me.x, W * 0.95);
    H.x = W * hiveX;
    if (G) G.x = W * golemX;
    [me, H, G, ...ambient].forEach((a) => a && a.layout());
    arrange();
    if (G) G.el.style.display = showGolem() ? '' : 'none';
  });
  if (lite) return; // 모션 줄이기: 정지 포즈만

  // ── 연출 보조 ─────────────────────────────────────────
  const gate = async () => { while (!inView || document.hidden) await sleep(400); };

  const goTo = async (a, x) => {
    a.turn(x > a.x ? 1 : -1);
    a.play('run');
    await a.move(x, 300);
    a.play('idle');
  };
  const edge = (dir, m = 80) => (dir > 0 ? W + m * K : -m * K); // dir 쪽 화면 밖 (m: 캐릭터 폭만큼 여유)

  // ── 사용자 조작 ───────────────────────────────────────
  // 주인공 클릭: 영혼불 -1, 다섯 번 맞으면 쓰러졌다가(게임처럼 영혼불은 모두 사라짐) 화면 밖에서 다시 달려 들어온다
  const PLAYER_HP = 5;
  me.hp = PLAYER_HP;
  me.clickable((e) => {
    if (me.held) return; // 쓰러짐·강화공격 중에는 무적
    sparkAt(e);
    me.hit();
    dropSouls(1);
    if (--me.hp <= 0) die();
  });
  me.layout();
  const die = async () => {
    me.held = true; cut++;
    dropSouls(Infinity);
    await me.play('hurt', true);
    me.play('death', true);
    await sleep(1400);
    me.el.style.opacity = 0;
    await sleep(600);
    const dir = pick([1, -1]);
    me.hp = PLAYER_HP;
    me.el.style.transition = 'none'; // 화면 밖으로 순간 이동
    me.x = edge(dir); me.face = -dir; me.put();
    void me.el.offsetWidth;
    me.el.style.opacity = '';
    await goTo(me, rnd(0.3, 0.7) * W);
    me.held = false;
  };

  // 강화공격 (게임 PlayerController 와 같은 흐름): 영혼불이 3개 이상일 때 빈 곳을 0.25초 누르고 있으면
  // 그 자리에서 영혼불 3개를 흡수하며 차지(AS + FX_Charging) → 손을 떼면 전방위 연속공격(Normal_AS_Attack + Slash_Aoe_Attack)
  const HOLD = 250, COST = 3;
  // FX_Charging: 반지름 6유닛 원에서 초록 빛줄기가 0.3초 만에 몸 중심으로 모여든다 (초당 30개)
  const chargeFx = () => {
    const [x, y] = mid(me), box = fxAt(x, y), u = unit();
    const t = setInterval(() => {
      const l = document.createElement('i');
      l.className = 'cs';
      l.style.width = 2.4 * u + 'px';
      box.append(l);
      const a = rnd(0, 360);
      l.animate([
        { transform: `rotate(${a}deg) translateX(${6 * u}px) scaleY(.57)`, opacity: 0 },
        { opacity: 1, offset: 0.43 },
        { transform: `rotate(${a}deg) translateX(0) scaleY(0)`, opacity: 0 },
      ], { duration: 300 }).onfinish = () => l.remove();
    }, 33);
    return () => { clearInterval(t); setTimeout(() => box.remove(), 300); };
  };
  // Slash_Aoe_Attack (크기 3.5배): 0.04초마다 20번, 사방으로 도는 고리 모양 베기(반지름 7유닛)와 번쩍이는 선.
  // 판정은 반지름 7유닛 안에 5 피해 × 10번(0.08초 간격)
  const aoe = () => {
    const [x, y] = mid(me), box = fxAt(x, y), u = unit();
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const s = document.createElement('i'), z = 14 * u, a = rnd(0, 360); // z: 고리 지름
        s.className = 'sl';
        s.style.cssText = `width:${z}px;height:${z}px;left:${rnd(-0.9, 0.9) * u - z / 2}px;top:${rnd(-0.9, 0.9) * u - z / 2}px;background-size:${9 * z}px ${z}px`;
        box.append(s);
        // 3D 로 아무렇게나 기운 고리를 정면에서 본 모양: 고리는 자기 면 안에서 돌고(spin), 그 면이 납작하게 보인다(scale) → 화면에선 고정된 타원을 따라 베기가 미끄러진다
        const sx = Math.cos(rnd(0, 6.28)).toFixed(2), sy = Math.cos(rnd(0, 6.28)).toFixed(2), spin = rnd(0, 360);
        const tf = (r) => `rotate(${a}deg) scale(${sx},${sy}) rotate(${r}deg)`;
        s.animate({ backgroundPositionX: ['0px', -9 * z + 'px'] }, { duration: 400, easing: 'steps(9)' });
        s.animate([
          { transform: tf(spin), filter: 'hue-rotate(0deg) brightness(3)' }, // 노랗게 번쩍 → 초록 → 청록으로 흐려짐
          { filter: 'hue-rotate(0deg) brightness(1)', offset: 0.15 },
          { filter: 'hue-rotate(40deg) brightness(.7)', opacity: 1, offset: 0.53 },
          { transform: tf(spin + 96), filter: 'hue-rotate(40deg) brightness(.7)', opacity: 0 },
        ], { duration: 400, easing: 'ease-out' }).onfinish = () => s.remove();
        const l = document.createElement('i'), b = rnd(0, 360);
        l.className = 'ln';
        l.style.cssText = `width:${10 * u}px;left:${-5 * u}px`;
        box.append(l);
        l.animate([
          { transform: `rotate(${b}deg) scale(0,0)`, color: '#fff' },
          { color: '#fff', offset: 0.11 },
          { transform: `rotate(${b}deg) scale(.77,1)`, color: '#000', offset: 0.15 },
          { color: '#000', offset: 0.2 },
          { color: '#dbffe6', offset: 0.22 },
          { color: '#54ff78', offset: 0.33 },
          { color: '#00a145', offset: 0.72 },
          { transform: `rotate(${b}deg) scale(1,0)`, color: '#00a145' },
        ], { duration: 300 }).onfinish = () => l.remove();
      }, i * 40);
    }
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        for (const el of stage.querySelectorAll('.mob')) {
          const m = el.actor, [mx, my] = mid(m);
          if (!m.el.offsetParent) continue; // 좁은 화면에서 숨긴 골렘
          if (Math.hypot(mx - x, my - y) < 7 * u + Math.min(m.d.hb[2], m.d.hb[3]) * K / 2) m.damage(null, 5);
        }
      }, i * 80);
    }
    setTimeout(() => box.remove(), 1000);
  };
  const hero = stage.parentElement;
  let hold = 0, pressing = false, stopCharge = null, px = 0, py = 0;
  hero.addEventListener('pointerdown', (e) => {
    if (e.button || me.held || fires.length < COST || e.target.closest('a, button, .hb')) return;
    pressing = true; px = e.clientX; py = e.clientY;
    const x = e.clientX - stage.getBoundingClientRect().left;
    hold = setTimeout(() => {
      if (me.held || fires.length < COST) return;
      me.held = true; cut++;
      me.turn(x > me.x ? 1 : -1);
      me.play('charge');
      dropSouls(COST);
      stopCharge = chargeFx();
    }, HOLD);
  });
  const release = async () => {
    pressing = false; clearTimeout(hold);
    if (!stopCharge) return;
    stopCharge(); stopCharge = null;
    aoe();
    await me.play('burst', true);
    me.play('idle');
    await sleep(820); // 연속공격 이펙트가 끝날 때까지
    me.held = false;
  };
  addEventListener('pointerup', release); // 화면 밖에서 손을 떼도 놓치지 않게 window 에서 받는다
  addEventListener('pointercancel', release); // 차지가 시작됐으면 영혼불은 이미 쓴 것 — 취소돼도 공격은 나간다
  hero.addEventListener('pointermove', (e) => { if (pressing && !stopCharge && Math.hypot(e.clientX - px, e.clientY - py) > 12) { pressing = false; clearTimeout(hold); } });
  hero.addEventListener('contextmenu', (e) => { if (pressing || stopCharge) e.preventDefault(); }); // 모바일 길게 누르기 메뉴 막기

  // 장면과 상관없이 계속 떠다니는 날벌레와 하이브 정령(하이브 주변에 2마리 대기)
  const roam = async (a, xr, yr, speed) => { // xr·yr 은 호출 시점의 범위를 돌려주는 함수 (화면 크기가 바뀌어도 따라가도록)
    for (;;) {
      await gate();
      if (a.dead) { await sleep(1000); continue; }
      const x = rnd(...xr()), y = rnd(...yr());
      a.turn(x > a.x ? 1 : -1);
      await a.move(x, speed, y);
      await sleep(rnd(200, 900));
    }
  };
  ambient.push(
    new Actor('spirit', H.x + 60 * K, { y: 110 * K, start: 'fly', keep: true }),
    new Actor('spirit', H.x - 40 * K, { y: 150 * K, start: 'fly', keep: true }),
    new Actor('fairy', W * 0.62, { y: 150 * K, start: 'fly', keep: true }),
  );
  const near = () => [H.x - 120 * K, H.x + 170 * K];
  roam(ambient[0], near, () => [90 * K, 170 * K], 60);
  roam(ambient[1], near, () => [110 * K, 190 * K], 50);
  roam(ambient[2], () => [W * 0.15, W * 0.9], () => [120 * K, 200 * K], 70);

  // ── 장면 ─────────────────────────────────────────────
  const scenes = {
    // 이끼벌레: 다가와서 몸을 말고 돌진 → 패링 → 반격
    async bug() {
      const dir = pick([1, -1]), tx = rnd(0.32, 0.68) * W;
      await goTo(P, tx);
      P.turn(dir);
      const bug = new Actor('bug', edge(dir), { face: -dir, start: 'walk' });
      await bug.move(tx + dir * 300 * K, 120);
      await bug.play('alert', true);
      await bug.play('ready', true);
      const charge = bug.move(tx + dir * 95 * K, 520);
      bug.play('roll');
      await sleep(170);
      const parry = P.play('parry', true);
      await charge;
      spark(tx + dir * 55 * K, 50 * K);
      bug.play('alert');
      bug.move(tx + dir * 190 * K, 260).catch(() => {}); // 그사이 쓰러지면 장면은 다음 호출에서 끝난다
      await parry;
      const atk = P.play('atk1', true);
      await sleep(180);
      bug.hit(); spark(tx + dir * 60 * K, 40 * K);
      await atk;
      await bug.vanish();
      P.play('idle');
    },

    // 날벌레: 위에서 급강하 → 패링
    async fairy() {
      const dir = pick([1, -1]), tx = rnd(0.3, 0.7) * W;
      await goTo(P, tx);
      P.turn(dir);
      const f = new Actor('fairy', edge(dir), { y: 120 * K, face: -dir, start: 'fly' });
      await f.move(tx + dir * 230 * K, 170, 110 * K);
      await f.play('ready', true);
      f.play('attack');
      const dive = f.move(tx + dir * 55 * K, 520, 30 * K);
      await sleep(130);
      const parry = P.play('parry', true);
      await dive;
      spark(tx + dir * 45 * K, 45 * K);
      f.hit();
      f.play('fly');
      f.turn(dir);
      const away = f.move(tx + dir * W, 320, 190 * K);
      await parry;
      P.play('idle');
      await away;
      f.el.remove();
    },

    // 큰씨앗벌레(보스): 다가와 꼬리 휘두르기 → 패링 → 반격 → 물러남
    async bigbug() {
      const dir = pick([1, -1]), tx = rnd(0.35, 0.65) * W;
      await goTo(P, tx);
      P.turn(dir);
      const b = new Actor('bigbug', edge(dir, 230), { face: -dir, start: 'walk' });
      await b.move(tx + dir * 170 * K, 110);
      b.play('idle');
      await sleep(400);
      const swing = b.play('attack', true); // A1: 1.17초에 꼬리를 휘두름
      await sleep(910);
      const parry = P.play('parry', true);
      await sleep(260);
      spark(tx + dir * 60 * K, 60 * K);
      await parry;
      const atk = P.play('atk1', true);
      await sleep(180);
      b.hit(); spark(tx + dir * 90 * K, 50 * K);
      await Promise.all([atk, swing]);
      P.play('idle');
      b.turn(dir);
      b.play('walk');
      await b.move(edge(dir, 230), 150);
      b.el.remove();
    },

    // 골렘: 두 팔로 내려치는 공격 → 패링 → 연속 공격 → 강공격
    async golem() {
      const x = G.x - 200 * K;
      await goTo(P, x);
      P.turn(1);
      await sleep(400);
      const slam = G.play('attack', true); // A3: 1.17초에 두 팔로 내려침
      await sleep(900);
      const parry = P.play('parry', true);
      await sleep(260);
      spark(x + 70 * K, 55 * K);
      await Promise.all([slam, parry]);
      G.play('idle');
      P.move(x + 45 * K, 160);
      await P.play('atk2', true);
      G.hit(); spark(G.x - 70 * K, 60 * K);
      await P.play('strong', true);
      G.hit();
      await sleep(300);
      P.play('idle');
    },

    // 하이브: 정령이 튀어나옴 → 패링 → 하이브로 돌격
    async hive() {
      const x = H.x + 260 * K;
      await goTo(P, x);
      P.turn(-1);
      H.play('pulse');
      await sleep(900);
      const s = new Actor('spirit', H.x, { y: 100 * K, face: 1, start: 'fly' });
      await s.move(H.x + 130 * K, 140, 150 * K);
      s.play('attack'); s.turn(1);
      const dive = s.move(x - 55 * K, 480, 30 * K);
      await sleep(130);
      const parry = P.play('parry', true);
      await dive;
      spark(x - 45 * K, 45 * K);
      await parry;
      s.hit();
      s.vanish();
      H.play('idle');
      await goTo(P, H.x + 120 * K);
      P.turn(-1);
      await P.play('atk1', true);
      H.hit(); spark(H.x + 40 * K, 60 * K);
      await P.play('atk2', true);
      H.hit();
      P.play('idle');
    },

    // 혼자 한바탕: 달려가서 연속 공격
    async solo() {
      await goTo(P, rnd(0.25, 0.75) * W);
      await sleep(300);
      await P.play('atk1', true);
      await P.play('atk2', true);
      await sleep(250);
      await P.play('strong', true);
      P.play('idle');
    },
  };

  (async () => {
    let last = '';
    const names = Object.keys(scenes).filter((n) => n !== 'golem' || G);
    for (;;) {
      await gate();
      while (me.held) await sleep(300); // 사용자 조작이 끝날 때까지 대기
      const name = pick(names.filter((n) => n !== last && !{ golem: G, hive: H }[n]?.dead)); // 쓰러진 고정 몹의 장면은 건너뜀
      last = name;
      sceneCut = cut;
      try { await scenes[name](); } catch {
        // 장면이 끊기면(몹이 쓰러짐·사용자 조작·오류) 다음 장면으로 — 남은 임시 캐릭터는 흐리게 지운다
        const keep = [me, H, G, ...ambient].map((a) => a && a.el);
        [...stage.children].forEach((el) => {
          if (!el.classList.contains('actor') || keep.includes(el)) return;
          el.style.opacity = 0;
          setTimeout(() => el.remove(), 550);
        });
      }
      await sleep(rnd(900, 2200));
    }
  })();
})();
