// 히어로 하단 연출: 주인공과 몬스터들이 돌아다니고 서로 싸웁니다.
// 몹·주인공 클릭 = 피격, 빈 곳 꾹 누르기 = 주인공 강공격, 몹을 쓰러뜨리면 영혼불 +1 / 주인공이 맞으면 -1
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
      this.el.actor = this; // 강공격 범위 판정용
      this.el.className = 'actor' + (['golem', 'hive', 'bug'].includes(name) ? ' smooth' : '');
      stage.append(this.el);
      if (!lite) for (const a of Object.values(this.d)) if (a.src) new Image().src = a.src; // 다음 동작 이미지를 미리 받아 둔다 (lite 는 첫 장면만 보여 줌)
      this.cur = [start || (this.d.idle ? 'idle' : 'fly'), false];
      if (HP[name]) {
        this.hp = HP[name];
        this.el.classList.add('mob');
        this.el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.damage(e); }); // preventDefault: 연타해도 글자가 선택되지 않게
      }
      this.layout();
    }
    // 크기·기준점 계산 (화면 배율이 바뀌면 다시 호출)
    layout() {
      if (this.dead) return; // 다시 나타날 때 호출됨
      const e = this.el.style;
      e.bottom = 6 - this.d.foot * K + 'px';
      e.transformOrigin = this.d.ax * K + 'px 100%';
      this.play(...this.cur);
      this.put();
      void this.el.offsetWidth; // 시작 위치를 확정해야 첫 move 가 화면 밖에서 미끄러져 들어온다
    }
    put() {
      this.el.style.transform = `translate(${this.x - this.d.ax * K}px,${-this.y}px) scaleX(${this.face})`;
    }
    // 동작 재생. a.f(프레임 번호)를 a.d(초)만큼씩 보여 준다 — Unity 애니메이션과 같은 타이밍.
    // once=true 면 마지막 프레임에서 멈춘다. 끝나는 시점에 풀리는 Promise 반환
    play(anim, once = false) {
      this.live();
      const a = this.d[anim], e = this.el, w = a.w * K, n = Math.max(...a.f) + 1;
      const T = a.d.reduce((s, d) => s + d, 0);
      this.cur = [anim, once];
      this.anim?.cancel();
      Object.assign(e.style, { width: w + 'px', height: a.h * K + 'px', backgroundImage: `url(${a.src})`, backgroundSize: `${n * w}px ${a.h * K}px`, backgroundPositionX: -a.f[0] * w + 'px' });
      if (a.f.length > 1 && !lite) {
        let t = 0;
        const kf = a.f.map((f, i) => {
          const k = { offset: t / T, backgroundPositionX: -f * w + 'px', easing: 'step-end' };
          t += a.d[i];
          return k;
        });
        kf.push({ offset: 1, backgroundPositionX: kf.at(-1).backgroundPositionX });
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
      setSouls(souls + 1);
      this.el.style.opacity = 0;
      if (!this.keep) return void setTimeout(() => this.el.remove(), 550);
      setTimeout(() => { this.dead = false; this.hp = HP[this.name]; this.layout(); this.el.style.opacity = ''; }, 10000);
    }
    async vanish() {
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

  // 영혼불: 게임처럼 최대 7개가 주인공 머리 위를 돈다
  let souls = 0;
  const ring = document.createElement('b');
  ring.className = 'souls';
  me.el.append(ring);
  const setSouls = (n) => {
    souls = Math.max(0, Math.min(7, n));
    ring.style.setProperty('--r', 10 + souls * 3 + 'px');
    ring.innerHTML = Array.from({ length: souls }, (_, i) => `<i style="--a:${i / souls}turn"></i>`).join('');
  };
  const placeRing = () => Object.assign(ring.style, { left: me.d.ax * K + 'px', bottom: (me.d.h - me.d.top + 14) * K + 'px' });
  placeRing();

  addEventListener('resize', () => {
    measure();
    me.x = Math.min(me.x, W * 0.95);
    H.x = W * hiveX;
    if (G) G.x = W * golemX;
    [me, H, G, ...ambient].forEach((a) => a && a.layout());
    placeRing();
    if (G) G.el.style.display = showGolem() ? '' : 'none';
  });
  if (lite) return; // 모션 줄이기: 정지 포즈만

  // ── 연출 보조 ─────────────────────────────────────────
  let inView = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(stage.parentElement);
  const gate = async () => { while (!inView || document.hidden) await sleep(400); };

  const goTo = async (a, x) => {
    a.turn(x > a.x ? 1 : -1);
    a.play('run');
    await a.move(x, 300);
    a.play('idle');
  };
  const edge = (dir, m = 80) => (dir > 0 ? W + m * K : -m * K); // dir 쪽 화면 밖 (m: 캐릭터 폭만큼 여유)

  // ── 사용자 조작 ───────────────────────────────────────
  // 주인공 클릭: 영혼불 -1, 다섯 번 맞으면 쓰러졌다가 화면 밖에서 다시 달려 들어온다
  const PLAYER_HP = 5;
  me.hp = PLAYER_HP;
  me.el.classList.add('mob');
  me.el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (me.held) return; // 쓰러짐·강공격 중에는 무적
    sparkAt(e);
    me.hit();
    setSouls(souls - 1);
    if (--me.hp <= 0) die();
  });
  const die = async () => {
    me.held = true; cut++;
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

  // 빈 곳을 꾹 누르면 그 자리로 달려가 강공격 — 양옆을 베어 주변 몹에게 3 피해
  const slash = async (x) => {
    me.held = true; cut++;
    await goTo(me, Math.min(Math.max(x, 40 * K), W - 40 * K));
    const done = me.play('strong', true);
    await sleep(600); // 베는 프레임
    for (const el of stage.querySelectorAll('.mob')) {
      const m = el.actor;
      if (m !== me && Math.abs(m.x - me.x) < 220 * K && m.y < 260 * K) m.damage(null, 3);
    }
    await done;
    me.play('idle');
    me.held = false;
  };
  const hero = stage.parentElement;
  let press = 0, pressing = false, px = 0, py = 0;
  hero.addEventListener('pointerdown', (e) => {
    if (e.button || e.target.closest('a, button, .mob')) return;
    pressing = true; px = e.clientX; py = e.clientY;
    const x = e.clientX - stage.getBoundingClientRect().left;
    press = setTimeout(() => { if (!me.held) slash(x); }, 450);
  });
  const release = () => { pressing = false; clearTimeout(press); };
  hero.addEventListener('pointerup', release);
  hero.addEventListener('pointercancel', release);
  hero.addEventListener('pointermove', (e) => { if (pressing && Math.hypot(e.clientX - px, e.clientY - py) > 12) release(); });
  hero.addEventListener('contextmenu', (e) => { if (pressing) e.preventDefault(); }); // 모바일 길게 누르기 메뉴 막기

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
      bug.move(tx + dir * 190 * K, 260);
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
