import type { CurvePreset } from './types'

export const CURVES: CurvePreset[] = [
  {
    id: 'smooth',
    name: 'Smooth glide',
    subtitle: 'Soft arrival',
    path: 'M8 84 C36 82, 24 30, 58 28 C78 27, 72 74, 112 8',
    cubic: [0.22, 0.61, 0.36, 1],
    accent: '#a7f7d2',
  },
  {
    id: 'ease',
    name: 'Ease out',
    subtitle: 'Quick, then calm',
    path: 'M8 84 C14 84, 20 79, 28 64 C43 36, 47 11, 112 8',
    cubic: [0.16, 1, 0.3, 1],
    accent: '#a7f7d2',
  },
  {
    id: 'overshoot',
    name: 'Overshoot',
    subtitle: 'A little bounce',
    path: 'M8 84 C25 78, 32 19, 64 13 C82 9, 78 30, 112 8',
    cubic: [0.34, 1.56, 0.64, 1],
    accent: '#a7f7d2',
  },
  {
    id: 'linear',
    name: 'Linear',
    subtitle: 'Constant speed',
    path: 'M8 84 L112 8',
    cubic: [0, 0, 1, 1],
    accent: '#a7f7d2',
  },
]

export const PALETTE = ['#B7A5FF', '#FFB86B', '#79D9C5', '#F18FB3', '#86B7FF']
