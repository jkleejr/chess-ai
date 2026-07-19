// Shared knight silhouette paths (viewBox 0 0 100 100), used by the candidate
// generator. Hand-tuned classic staunton-style knight facing left.

export const KNIGHT_CLASSIC = `
M 30 88
L 78 88
L 78 82
C 78 78 75 76 72 74
C 74 62 76 48 72 37
C 68 26 58 18 46 16
C 45 12 43 9 41 7
C 40 6 38 6 38 8
L 38 14
C 35 15 32 17 30 20
C 27 24 22 30 18 34
C 16 36 16 39 18 41
L 24 46
C 26 48 29 48 31 46
C 34 44 38 42 41 41
C 42 41 43 42 42 44
C 39 50 34 56 31 63
C 28 70 28 78 30 82
C 27 76 24 84 30 88
Z`

// Angular / minimal knight — fewer curves, modern mark.
export const KNIGHT_MINIMAL = `
M 28 88
L 78 88
L 78 80
L 70 74
C 74 60 74 44 66 32
C 60 23 50 17 42 16
L 40 8
L 34 14
L 20 34
L 30 46
L 42 40
C 38 52 30 60 28 72
Z`

export const EYE = { cx: 41, cy: 26, r: 3 }
