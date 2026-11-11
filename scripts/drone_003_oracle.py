# SPDX-License-Identifier: Apache-2.0
"""Independent Fraction gate oracle, IEEE binary32 projection and integer PCM."""
import hashlib
import json
import struct
import sys
from fractions import Fraction


def crossing(case):
    g, a, b = case['gate'], case['from'], case['to']
    axis = 0 if g['axis'] == 'x' else 2
    side = 2 if axis == 0 else 0
    delta = b[axis] - a[axis]
    if delta * g['direction'] <= 0:
        return False
    t = Fraction(g['raw']['plane'] - a[axis], delta)
    if not 0 < t <= 1:
        return False
    point = [Fraction(a[i]) + t * (b[i] - a[i]) for i in range(3)]
    return (abs(point[side] - g['raw']['side']) <= g['raw']['halfWidth']
            and g['raw']['bottom'] <= point[1] <= g['raw']['top'])


def f32(n):
    return struct.unpack('<f', struct.pack('<f', n))[0]


def projection(case):
    data, matrix = case['data'], list(map(f32, case['matrix']))
    out = []
    for i in range(0, len(data), 6):
        p = list(map(f32, data[i:i+6]))
        for row in range(4):
            products = [f32(p[col] * matrix[col*4+row]) for col in range(3)]
            out.append(f32(f32(f32(products[0] + products[1]) + products[2]) + matrix[row+12]))
        out.extend(p[3:])
    return out


def sample(event, n):
    local = n - event['sample']
    if not 0 <= local < event['duration']:
        return 0
    phase = (local * event['frequency']) % 48000
    wave = event['wave']
    if wave == 'square':
        value = 32767 if phase < 24000 else -32767
    elif wave == 'saw':
        value = 65534 * phase // 48000 - 32767
    elif wave == 'triangle':
        if phase < 12000:
            value = 32767 * phase // 12000
        elif phase < 36000:
            value = 32767 - 65534 * (phase-12000) // 24000
        else:
            value = -32767 + 32767 * (phase-36000) // 12000
    else:
        x = (event['seed'] ^ ((local+1)*0x9e3779b9 & 0xffffffff)) & 0xffffffff
        x ^= (x << 13) & 0xffffffff
        x ^= x >> 17
        x ^= (x << 5) & 0xffffffff
        value = ((x >> 16) & 65535) - 32768
    gain = event['gain'] * (event['duration']-local) // event['duration']
    return int(Fraction(value * gain, 32767))


def pcm(score):
    samples = [max(-32768, min(32767, sum(sample(e, n) for e in score['events'])))
               for n in range(score['frames'])]
    return hashlib.sha256(struct.pack('<'+'h'*len(samples), *samples)).hexdigest()


request = json.load(sys.stdin)
print(json.dumps({'crossings': [crossing(c) for c in request.get('crossings', [])],
                  'projections': [projection(c) for c in request.get('projections', [])],
                  'pcm': [pcm(s) for s in request.get('pcm', [])]}))
