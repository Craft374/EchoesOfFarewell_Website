#!/usr/bin/env python3
"""히어로 캐릭터 스프라이트 스트립 + docs/js/sprites.js 생성 (ImageMagick 필요).

캐릭터마다 모든 동작의 프레임을 '같은 잘라내기 상자'로 잘라 기준점을 통일합니다.
(프레임마다 따로 자르면 동작이 바뀔 때 몸이 흔들립니다.)
실행: python3 tools/make_sprites.py
"""
import json, subprocess, os, tempfile

G = os.environ.get('EOF_GITHUB', '/Users/jeongwoo/Documents/Github')  # 게임/애니메이션 저장소들이 있는 폴더
SP = f'{G}/EchoesOfFarewell/Assets/Sprites'
AN = f'{G}/EOF_Animation'
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs')
IMG = f'{OUT}/assets/img/sprites'
os.makedirs(IMG, exist_ok=True)
TMP = tempfile.mkdtemp()

def rng(fmt, a, b): return [fmt.format(i) for i in range(a, b + 1)]

PLAYER = f'{SP}/Player_Sprites'
# 캐릭터: scale(원본 1px → 표시 px), nearest(도트 유지), center(프레임 크기가 제각각이면 중앙 정렬), 동작별 (프레임, fps)
ACTORS = {
  'player': dict(scale=1.6, nearest=True, foot='idle', anims={
    'idle':   (rng(f'{PLAYER}/Player_Idle/Player_Idle/F{{}}.png', 0, 2), 5),
    'run':    (rng(f'{PLAYER}/Player_Running/Player_Running/F{{}}.png', 0, 5), 12),
    'atk1':   (rng(f'{PLAYER}/Player_A2/Player_A2/F{{}}.png', 0, 4), 14),
    'atk2':   (rng(f'{PLAYER}/Player_A3/F{{}}.png', 0, 4), 14),
    'parry':  ([f'{PLAYER}/Player_Parry_New/Player_Parry_New_{i:04d}.png' for i in range(11)], 18),
    'strong': (rng(f'{PLAYER}/Player_AS/F{{}}.png', 0, 18), 20),
  }),
  'bug': dict(scale=1.4, nearest=True, foot='walk', anims={
    'walk':  (rng(f'{AN}/moss_bug/moss_bug_walk_{{}}.png', 1, 6), 10),
    'roll':  (rng(f'{AN}/moss_bug/moss_bug_roll_{{}}.png', 1, 5) + [f'{AN}/moss_bug/moss_bug_roll6.png'], 16),
    'alert': (rng(f'{AN}/moss_bug/moss_bug_what_{{}}.png', 1, 2), 6),
  }),
  'fairy': dict(scale=1.3, nearest=True, foot=None, anims={
    'fly':    (rng(f'{SP}/Eenmies_Sprites/Seed_Spirit/Seed_Spirit_fly_{{}}.png', 1, 3), 10),
    'attack': (rng(f'{SP}/Eenmies_Sprites/Seed_Spirit/Seed_Spirit_atack_{{}}.png', 1, 3), 10),
  }),
  'golem': dict(scale=0.27, nearest=False, foot='idle', align='feet', anims={
    'idle':   ([f'{SP}/Eenmies_Sprites/Golem/golem{i}.png' for i in (1, 5, 6, 5)], 4),
    'attack': ([f'{SP}/Eenmies_Sprites/Golem/golem{i}.png' for i in (9, 10, 11, 11, 12, 12, 13)], 8),
  }),
  'hive': dict(scale=1.6, nearest=True, foot='idle', anims={
    'idle':  ([f'{SP}/Eenmies_Sprites/hive/off.png'], 1),
    'pulse': ([f'{SP}/Eenmies_Sprites/hive/off.png', f'{SP}/Eenmies_Sprites/hive/on.png'], 2),
  }),
  'spirit': dict(scale=1.0, nearest=True, foot=None, center=(72, 70), anims={
    'fly':    (rng(f'{SP}/Eenmies_Sprites/hive/flying/fly{{}}.png', 1, 3), 10),
    'attack': (rng(f'{SP}/Eenmies_Sprites/hive/flying/atack{{}}.png', 1, 3), 10),
  }),
}

def sh(*a): return subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()

def bbox(f):  # (x0, y0, x1, y1) 불투명 영역
    g = sh('magick', f, '-format', '%@', 'info:')  # WxH+X+Y
    size, rest = g.split('+', 1)
    w, h = map(int, size.split('x')); x, y = map(int, rest.split('+'))
    return x, y, x + w, y + h

def feet(f):  # 발 쪽(아래 22%) 중심 x 와 맨 아래 y
    x0, y0, x1, y1 = bbox(f)
    top = y1 - max(1, round((y1 - y0) * 0.22))
    g = sh('magick', f, '-crop', f'{x1 - x0}x{y1 - top}+{x0}+{top}', '+repage', '-format', '%@', 'info:')
    size, rest = g.split('+', 1)
    w, _ = map(int, size.split('x')); gx, _ = map(int, rest.split('+'))
    return x0 + gx + w / 2, y1

def align_feet(c, name):
    # 프레임마다 발 위치가 몇 px 달라 보이면 재생할 때 몸이 1px 씩 튄다 → 첫 프레임 기준으로 발을 맞춘다
    ref = None
    for an, (fr, fps) in c['anims'].items():
        new = []
        for i, f in enumerate(fr):
            cx, by = feet(f)
            ref = ref or (cx, by)
            dx, dy = round(ref[0] - cx), round(ref[1] - by)
            t = f'{TMP}/al_{name}_{an}_{i}.png'
            sh('magick', f, '-background', 'none', '-roll', f'{dx:+d}{dy:+d}', t)
            new.append(t)
        c['anims'][an] = (new, fps)

out = {}
for name, c in ACTORS.items():
    if c.get('align') == 'feet':
        align_feet(c, name)
    frames = [f for fr, _ in c['anims'].values() for f in fr]
    if c.get('center'):
        cw, ch = c['center']; box = f'{cw}x{ch}+0+0'; bw, bh = cw, ch; by1 = None
    else:
        bs = [bbox(f) for f in dict.fromkeys(frames)]
        x0 = min(b[0] for b in bs); y0 = min(b[1] for b in bs); x1 = max(b[2] for b in bs); y1 = max(b[3] for b in bs)
        bw, bh = x1 - x0, y1 - y0; box = f'{bw}x{bh}+{x0}+{y0}'; by1 = y1
    foot, ax = 0, round(bw * c['scale'] / 2)
    if c['foot']:
        ib = bbox(c['anims'][c['foot']][0][0])  # 기준 동작 첫 프레임의 몸통 위치
        foot = round((by1 - ib[3]) * c['scale'])  # 가장 낮은 점과 발바닥 차이
        ax = round(((ib[0] + ib[2]) / 2 - x0) * c['scale'])  # 몸 중심 x (좌우 반전의 축)
    res = ['-filter', 'point', '-resize', f"{c['scale']*100}%"] if c['nearest'] else ['-resize', f"{c['scale']*100}%"]
    out[name] = {'foot': foot, 'ax': ax}
    for an, (fr, fps) in c['anims'].items():
        tmp = []
        for i, f in enumerate(fr):
            t = f'{TMP}/{name}_{an}_{i}.png'
            if c.get('center'):
                sh('magick', f, '-background', 'none', '-gravity', 'center', '-extent', box.split('+')[0], *res, t)
            else:
                sh('magick', f, '-crop', box, '+repage', *res, t)
            tmp.append(t)
        dst = f'{IMG}/{name}-{an}.webp'
        sh('magick', *tmp, '+append', '-define', 'webp:lossless=true', dst)
        w, h = map(int, sh('identify', '-format', '%w %h', dst).split())
        out[name][an] = {'src': f'assets/img/sprites/{name}-{an}.webp', 'n': len(fr), 'w': w // len(fr), 'h': h, 'fps': fps}
        for t in tmp: os.remove(t)
    print(name, {k: (v['n'], v['w'], v['h']) for k, v in out[name].items() if k not in ('foot', 'ax')}, 'foot', foot, 'ax', ax)

open(f'{OUT}/js/sprites.js', 'w').write('// tools/make_sprites.py 로 생성됨 — 직접 수정하지 마세요\nwindow.SPRITES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
