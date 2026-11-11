#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent Float64 -> Q16.16 truncation oracle; Python stdlib only."""
import json
import math
import random
from fractions import Fraction

def corpus():
    fixed = [0.0, -0.0, 0.1, -0.1, 1.0, -1.0, 3.5, -3.5,
             32767.0, -32768.0, 32767.99998474121, -32767.99998474121,
             1 / 65536, -1 / 65536, 1 / 131072, -1 / 131072,
             math.nextafter(1 / 65536, 0.0),
             math.nextafter(-1 / 65536, 0.0)]
    rng = random.Random(0xD002)
    fixed.extend((rng.random() - 0.5) * 600 for _ in range(1024))
    for _ in range(256):
        centre = rng.randrange(-12000000, 12000000) / 65536
        fixed.extend((math.nextafter(centre, -math.inf),
                      centre, math.nextafter(centre, math.inf)))
    return fixed

if __name__ == "__main__":
    values = []
    for value in corpus():
        raw = int(Fraction.from_float(value) * 65536)
        if not -(1 << 31) <= raw < (1 << 31):
            raise ValueError("oracle corpus outside signed int32")
        values.append([value, raw])
    print(json.dumps({"kind": "qsol.drone.float-q16.oracle.v1",
                      "rounding": "exact binary64 times 65536; toward zero",
                      "cases": values}, separators=(",", ":")))
