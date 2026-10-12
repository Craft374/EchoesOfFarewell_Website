#!/usr/bin/env python3
"""히어로 캐릭터 스프라이트 스트립 + docs/js/sprites.js 생성 (ImageMagick 필요).

몬스터는 게임 저장소의 Unity 애니메이션(.anim)을 그대로 읽어 프레임 순서·길이를 맞춥니다.
프레임은 Unity 처럼 스프라이트 기준점(pivot)과 PPU 로 한 캔버스에 놓은 뒤,
캐릭터마다 '같은 잘라내기 상자'로 잘라 기준점을 통일합니다. (프레임마다 따로 자르면 동작이 바뀔 때 몸이 흔들립니다.)
실행: python3 tools/make_sprites.py
"""
import glob, json, os, re, subprocess, tempfile

G = os.environ.get('EOF_GITHUB', '/Users/jeongwoo/Documents/Github')  # 게임 저장소가 있는 폴더
UA = f'{G}/EchoesOfFarewell/Assets'
SP = f'{UA}/Sprites'
EN = f'{SP}/Eenmies_Sprites'
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs')
IMG = f'{OUT}/assets/img/sprites'
os.makedirs(IMG, exist_ok=True)
TMP = tempfile.mkdtemp()

def sh(*a): return subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()

# ── Unity 에셋 읽기 ───────────────────────────────────
GUID = {}  # .meta 의 guid → 이미지 경로
for m in glob.glob(f'{SP}/**/*.png.meta', recursive=True):
    g = re.search(r'^guid: (\w+)', open(m).read(), re.M)
    if g: GUID[g[1]] = m[:-5]

ALIGN = {0: (.5, .5), 1: (0, 1), 2: (.5, 1), 3: (1, 1), 4: (0, .5), 5: (1, .5), 6: (0, 0), 7: (.5, 0), 8: (1, 0)}  # 9 = 직접 지정

def sprite(path, fid=None):
    """(경로, 잘라낼 영역 x,y,w,h — Unity 좌표라 y 는 아래부터, 기준점, PPU)"""
    t = open(path + '.meta').read()
    ppu = float(re.search(r'spritePixelsToUnits: ([\d.]+)', t)[1])
    subs = t.split('spriteSheet:')[1].split('\n    - serializedVersion')[1:]  # 여러 장 모드의 스프라이트들
    if subs:
        s = next((s for s in subs if f'internalID: {fid}\n' in s), subs[0])
        rect = tuple(float(re.search(rf'\b{k}: ([\d.]+)', s)[1]) for k in ('x', 'y', 'width', 'height'))
        al = int(re.search(r'alignment: (\d+)', s)[1])
        pv = re.search(r'pivot: \{x: ([\d.e-]+), y: ([\d.e-]+)\}', s)
    else:
        w, h = map(int, sh('identify', '-format', '%w %h', path).split())
        rect = (0, 0, w, h)
        al = int(re.search(r'^  alignment: (\d+)', t, re.M)[1])
        pv = re.search(r'spritePivot: \{x: ([\d.e-]+), y: ([\d.e-]+)\}', t)
    pivot = (float(pv[1]), float(pv[2])) if al == 9 else ALIGN[al]
    return path, rect, pivot, ppu

def clip(rel, slow=1):
    """Unity 애니메이션 → [(스프라이트, 초)]. 같은 스프라이트가 이어지면 합치고, 끝을 표시하는 1틱짜리 키는 앞 프레임에 붙인다.
    slow: 재생 시간 배율 (2 면 두 배 느리게)"""
    t = open(f'{UA}/{rel}.anim').read()
    stop = float(re.search(r'm_StopTime: ([\d.]+)', t)[1])
    sr = float(re.search(r'm_SampleRate: ([\d.]+)', t)[1])
    ks = re.findall(r'time: ([\d.e-]+)\s+value: \{fileID: (-?\d+), guid: (\w+)', t.split('m_PPtrCurves:')[1].split('attribute: m_Sprite')[0])
    out = []
    for i, (tm, fid, g) in enumerate(ks):
        d = (float(ks[i + 1][0]) if i + 1 < len(ks) else stop) - float(tm)
        if out and out[-1][0] == (GUID[g], fid): out[-1][1] += d
        else: out.append([(GUID[g], fid), d])
    if len(out) > 1 and out[-1][1] <= 1.5 / sr: out[-2][1] += out.pop()[1]
    return [(sprite(*k), d * slow) for k, d in out]

def files(paths, fps): return [(sprite(p), 1 / fps) for p in paths]
def rng(fmt, a, b): return [fmt.format(i) for i in range(a, b + 1)]

PLAYER = f'{SP}/Player_Sprites'
# 캐릭터: scale(Unity 1유닛 → 표시 px, 원본 1px 은 scale/PPU), nearest(도트 유지), flip(왼쪽을 보는 그림이면 오른쪽 기준으로 뒤집기), 동작별 [(스프라이트, 초)]
ACTORS = {
  'player': dict(scale=25.6, nearest=True, foot='idle', anims={  # 주인공은 Unity 클립 대신 직접 고른 프레임
    'idle':   files(rng(f'{PLAYER}/Player_Idle/Player_Idle/F{{}}.png', 0, 2), 5),
    'run':    files(rng(f'{PLAYER}/Player_Running/Player_Running/F{{}}.png', 0, 5), 12),
    'atk1':   files(rng(f'{PLAYER}/Player_A2/Player_A2/F{{}}.png', 0, 4), 14),
    'atk2':   files(rng(f'{PLAYER}/Player_A3/F{{}}.png', 0, 4), 14),
    'parry':  files([f'{PLAYER}/Player_Parry_New/Player_Parry_New_{i:04d}.png' for i in range(11)], 18),
    'strong': files(rng(f'{PLAYER}/Player_AS/F{{}}.png', 0, 18), 20),
  }),
  'bug': dict(scale=13.5, nearest=False, foot='walk', anims={
    'walk':  clip('Sprites/Eenmies_Sprites/moss_bug/Chase'),
    'alert': clip('Sprites/Eenmies_Sprites/moss_bug/Aggro'),
    'ready': clip('Sprites/Eenmies_Sprites/moss_bug/ChargeReady'),
    'roll':  clip('Sprites/Eenmies_Sprites/moss_bug/Charging'),
  }),
  'bigbug': dict(scale=13.5, nearest=True, flip=True, foot='idle', anims={
    'idle':   clip('Sprites/Eenmies_Sprites/Big_seed_bug/IDLE'),
    'walk':   clip('Sprites/Eenmies_Sprites/Big_seed_bug/Chase'),
    'attack': clip('Sprites/Eenmies_Sprites/Big_seed_bug/A1'),  # 꼬리 휘두르기
  }),
  'fairy': dict(scale=20.8, nearest=True, foot=None, anims={
    'fly':    clip('Animations/Enemies/Seed_Spirit_fly', slow=3),  # 게임 클립은 0.1초 주기(초당 30장)라 사이트 크기에선 너무 빨라 보여 3배 느리게
    'ready':  clip('Animations/Enemies/Seed_Spirit_A1_before'),
    'attack': clip('Animations/Enemies/Seed_Spirit_A1'),
  }),
  'golem': dict(scale=13.5, nearest=False, foot='idle', align='feet', anims={
    'idle':   clip('Sprites/Eenmies_Sprites/Golem/IDLE'),
    'attack': clip('Sprites/Eenmies_Sprites/Golem/A3'),
  }),
  'hive': dict(scale=25.6, nearest=True, foot='idle', anims={  # 하이브는 Unity 애니메이션이 없음
    'idle':  files([f'{EN}/hive/off.png'], 1),
    'pulse': files([f'{EN}/hive/off.png', f'{EN}/hive/on.png'], 2),
  }),
  'spirit': dict(scale=16, nearest=True, foot=None, anims={
    'fly':    clip('Animations/Enemies/HiveSpirit_fly', slow=3),  # 씨앗 정령과 같은 이유
    'attack': clip('Animations/Enemies/HiveSpirit_A1'),
  }),
}

def bbox(f):  # (x0, y0, x1, y1) 불투명 영역
    g = sh('magick', f, '-format', '%@', 'info:')  # WxH+X+Y
    size, rest = g.split('+', 1)
    w, h = map(int, size.split('x')); x, y = map(int, rest.split('+'))
    return x, y, x + w, y + h

def place(sp, c, ref, cv, t):
    # Unity 처럼 기준점을 캔버스 중앙에 맞춰 붙인다 (원본 해상도 그대로, PPU 가 다른 프레임만 그 비율로 크기 조정)
    path, (x, y, w, h), (px, py), ppu = sp
    _, H = map(int, sh('identify', '-format', '%w %h', path).split())
    f = ref / ppu
    ox, oy = round(cv / 2 - px * w * f), round(cv / 2 - (1 - py) * h * f)
    sh('magick', '-size', f'{cv}x{cv}', 'xc:none', '(', path, '-crop', f'{w:g}x{h:g}+{x:g}+{H - y - h:g}', '+repage',
       *([] if f == 1 else ['-resize', f'{f*100}%']), ')', '-geometry', f'{ox:+d}{oy:+d}', '-composite', *(['-flop'] if c.get('flip') else []), t)

def feet(f):  # 발 쪽(아래 22%) 중심 x 와 맨 아래 y
    x0, y0, x1, y1 = bbox(f)
    top = y1 - max(1, round((y1 - y0) * 0.22))
    g = sh('magick', f, '-crop', f'{x1 - x0}x{y1 - top}+{x0}+{top}', '+repage', '-format', '%@', 'info:')
    size, rest = g.split('+', 1)
    w, _ = map(int, size.split('x')); gx, _ = map(int, rest.split('+'))
    return x0 + gx + w / 2, y1

def align_feet(placed):
    # 프레임마다 발 위치가 몇 px 달라 보이면 재생할 때 몸이 1px 씩 튄다 → 첫 프레임 기준으로 발을 맞춘다
    ref = None
    for f in placed:
        cx, by = feet(f)
        ref = ref or (cx, by)
        sh('magick', f, '-background', 'none', '-roll', f'{round(ref[0] - cx):+d}{round(ref[1] - by):+d}', f)

out = {}
for name, c in ACTORS.items():
    sps = list(dict.fromkeys(sp for fr in c['anims'].values() for sp, _ in fr))  # 서로 다른 프레임
    ref = sps[0][3]  # 첫 프레임의 PPU 기준으로 붙이고, 마지막에 한 번만 표시 크기로 줄이거나 키운다
    cv = 2 * round(max(max(sp[1][2], sp[1][3]) * ref / sp[3] for sp in sps)) + 4  # 기준점이 어디 있든 들어가는 캔버스
    placed = []
    for i, sp in enumerate(sps):
        placed.append(f'{TMP}/{name}_{i}.png')
        place(sp, c, ref, cv, placed[-1])
    if c.get('align') == 'feet':
        align_feet(placed)
    bs = [bbox(f) for f in placed]
    x0 = min(b[0] for b in bs); y0 = min(b[1] for b in bs); x1 = max(b[2] for b in bs); y1 = max(b[3] for b in bs)
    bw, bh = x1 - x0, y1 - y0
    k = c['scale'] / ref  # 원본 1px → 표시 px
    foot, ax = 0, round(bw * k / 2)
    if c['foot']:
        ib = bs[sps.index(c['anims'][c['foot']][0][0])]  # 기준 동작 첫 프레임의 몸통 위치
        foot = round((y1 - ib[3]) * k)  # 가장 낮은 점과 발바닥 차이
        ax = round(((ib[0] + ib[2]) / 2 - x0) * k)  # 몸 중심 x (좌우 반전의 축)
    res = ['-filter', 'point', '-resize', f'{k*100}%'] if c['nearest'] else ['-resize', f'{k*100}%']
    out[name] = {'foot': foot, 'ax': ax}
    for an, fr in c['anims'].items():
        used = list(dict.fromkeys(sp for sp, _ in fr))  # 스트립에는 같은 프레임을 한 번만 넣는다
        dst = f'{IMG}/{name}-{an}.webp'
        tmp = []
        for i, sp in enumerate(used):
            tmp.append(f'{TMP}/{name}_{an}_{i}.png')
            sh('magick', placed[sps.index(sp)], '-crop', f'{bw}x{bh}+{x0}+{y0}', '+repage', *res, tmp[-1])
        sh('magick', *tmp, '+append', '-define', 'webp:lossless=true', dst)
        w, h = map(int, sh('identify', '-format', '%w %h', dst).split())
        out[name][an] = {'src': f'assets/img/sprites/{name}-{an}.webp', 'w': w // len(used), 'h': h,
                         'f': [used.index(sp) for sp, _ in fr], 'd': [round(d, 3) for _, d in fr]}  # 재생 순서(프레임 번호)와 각 프레임 길이(초)
    print(name, {a: (len(v['f']), v['w'], v['h'], round(sum(v['d']), 2)) for a, v in out[name].items() if a not in ('foot', 'ax')}, 'foot', foot, 'ax', ax)

for f in glob.glob(f'{IMG}/*.webp'):  # 더 이상 쓰지 않는 동작의 이미지 정리
    if os.path.basename(f)[:-5].split('-', 1)[1] not in out.get(os.path.basename(f).split('-')[0], {}): os.remove(f)

open(f'{OUT}/js/sprites.js', 'w').write('// tools/make_sprites.py 로 생성됨 — 직접 수정하지 마세요\nwindow.SPRITES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
