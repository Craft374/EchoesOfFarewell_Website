// 히어로 하단 연출: 주인공과 몬스터들이 돌아다니고 서로 싸웁니다.
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

  class Actor {
    constructor(name, x, { y = 0, face = 1, start } = {}) {
      this.d = S[name];
      this.x = x; this.y = y; this.face = face;
      this.el = document.createElement('i');
      this.el.className = 'actor' + (name === 'golem' || name === 'hive' ? ' smooth' : '');
      stage.append(this.el);
      this.cur = [start || (this.d.idle ? 'idle' : 'fly'), false];
      this.layout();
    }
    // 크기·기준점 계산 (화면 배율이 바뀌면 다시 호출)
    layout() {
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
    // 동작 재생. once=true 면 마지막 프레임에서 멈춘다. 끝나는 시점에 풀리는 Promise 반환
    play(anim, once = false) {
      const a = this.d[anim], e = this.el, w = a.w * K;
      this.cur = [anim, once];
      Object.assign(e.style, { width: w + 'px', height: a.h * K + 'px', backgroundImage: `url(${a.src})`, backgroundSize: `${a.n * w}px ${a.h * K}px` });
      e.style.setProperty('--end', -a.n * w + 'px');
      e.style.setProperty('--end1', -(a.n - 1) * w + 'px');
      e.style.animation = 'none';
      void e.offsetWidth; // 애니메이션 처음부터 다시 시작
      e.style.animation = a.n < 2 || lite ? 'none'
        : once ? `cyc1 ${(a.n - 1) / a.fps}s steps(${a.n - 1}) forwards`
        : `cyc ${a.n / a.fps}s steps(${a.n}) infinite`;
      return sleep((a.n / a.fps) * 1000);
    }
    turn(f) {
      if (f === this.face) return;
      this.el.style.transition = 'opacity .5s'; // 방향 전환은 즉시
      this.face = f;
      this.put();
      void this.el.offsetWidth;
    }
    async move(x, speed, y = this.y) {
      const d = Math.max(Math.hypot(x - this.x, y - this.y) / (speed * K), 0.01);
      this.el.style.transition = `transform ${d}s linear, opacity .5s`;
      this.x = x; this.y = y;
      this.put();
      await sleep(d * 1000);
    }
    hit() { // 피격 반짝임
      this.el.classList.add('hit');
      setTimeout(() => this.el.classList.remove('hit'), 160);
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

  // ── 등장인물 ──────────────────────────────────────────
  const hiveX = 0.1, golemX = 0.86; // 고정 몬스터 위치(폭 비율)
  const showGolem = () => W >= 560;
  const P = new Actor('player', W * 0.5);
  const H = new Actor('hive', W * hiveX);
  const G = showGolem() ? new Actor('golem', W * golemX, { face: -1 }) : null;

  addEventListener('resize', () => {
    measure();
    P.x = Math.min(P.x, W * 0.95);
    H.x = W * hiveX;
    if (G) G.x = W * golemX;
    [P, H, G].forEach((a) => a && a.layout());
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
  const edge = (dir) => (dir > 0 ? W + 80 * K : -80 * K); // dir 쪽 화면 밖

  // ── 장면 ─────────────────────────────────────────────
  const scenes = {
    // 땅벌레: 다가와서 몸을 말고 돌진 → 패링 → 반격
    async bug() {
      const dir = pick([1, -1]), tx = rnd(0.32, 0.68) * W;
      await goTo(P, tx);
      P.turn(dir);
      const bug = new Actor('bug', edge(dir), { face: -dir, start: 'walk' });
      await bug.move(tx + dir * 300 * K, 120);
      bug.play('alert');
      await sleep(800);
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
      await sleep(500);
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

    // 골렘: 두 팔로 내려치는 공격 → 패링 → 연속 공격 → 강공격
    async golem() {
      const x = G.x - 200 * K;
      await goTo(P, x);
      P.turn(1);
      await sleep(400);
      const slam = G.play('attack', true);
      await sleep(330);
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
      const name = pick(names.filter((n) => n !== last));
      last = name;
      try { await scenes[name](); } catch {
        // 장면 도중 오류가 나도 다음 장면으로 (남은 임시 캐릭터는 정리)
        [...stage.children].forEach((el) => { if (el.classList.contains('actor') && ![P.el, H.el, G && G.el].includes(el)) el.remove(); });
      }
      await sleep(rnd(900, 2200));
    }
  })();
})();
