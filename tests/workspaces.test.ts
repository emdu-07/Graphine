import assert from 'node:assert/strict'
import { after, before, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'
import { emphasizeEasing } from '../src/easing.ts'
import { buildMotionResult } from '../src/motion/engine.ts'

// Use the application's existing TSX transform without adding a test dependency.
let server: ViteDevServer
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false, watch: null } })
})
after(async () => { await server?.close() })

it('renders the Motion outlet without adding a layout wrapper and leaves Reference reserved', async () => {
  const { WorkspaceOutlet } = await server.ssrLoadModule('/src/workspaces/WorkspaceOutlet.tsx')
  const child = createElement('section', { className: 'content-grid' }, 'Motion')
  assert.equal(renderToStaticMarkup(createElement(WorkspaceOutlet, { workspaceId: 'motion' }, child)), '<section class="content-grid">Motion</section>')
  assert.equal(renderToStaticMarkup(createElement(WorkspaceOutlet, { workspaceId: 'reference' }, child)), '')
})

it('keeps Motion navigation and theme controls without exposing Reference', async () => {
  const { Sidebar } = await server.ssrLoadModule('/src/components/layout/Sidebar.tsx')
  for (const theme of ['light', 'dark']) {
    const html = renderToStaticMarkup(createElement(Sidebar, { theme, onToggleTheme: () => {} }))
    assert.match(html, /aria-label="Motion Canvas"/)
    assert.match(html, /title="Motion Canvas"/)
    assert.match(html, new RegExp(`aria-label="Switch to ${theme === 'dark' ? 'light' : 'dark'} theme"`))
    assert.doesNotMatch(html, /Reference|SOON/)
  }
})

it('renders the waiting guide for an empty MotionResult', async () => {
  const { MotionGuide } = await server.ssrLoadModule('/src/workspaces/motion/MotionGuide.tsx')
  const html = renderToStaticMarkup(createElement(MotionGuide, {
    motionResult: buildMotionResult([]), activeTab: 'curves', setActiveTab: () => {},
  }))
  assert.match(html, /Your graphs will appear here/)
  assert.match(html, /X-position/)
  assert.match(html, /Y-position/)
  assert.doesNotMatch(html, /recorded-graphs|steps-list/)
})

const result = buildMotionResult([
  { time: 0, x: 0, y: 0, rotation: 0 },
  { time: .25, x: 20, y: 10, rotation: 30 },
])

it('renders only the selected channel using the engine-supplied curve handles', async () => {
  const { MotionGraphs } = await server.ssrLoadModule('/src/workspaces/motion/MotionGraphs.tsx')
  for (const curveChannel of ['position', 'rotation'] as const) {
    const html = renderToStaticMarkup(createElement(MotionGraphs, {
      motionResult: result, curveChannel, setCurveChannel: () => {}, onShowSteps: () => {},
    }))
    assert.match(html, new RegExp(`aria-label="${curveChannel} easing curve`))
    assert.doesNotMatch(html, new RegExp(`aria-label="${curveChannel === 'position' ? 'rotation' : 'position'} easing curve`))
    const curve = result.curves.find(curve => curve.channel === curveChannel)!
    assert.ok(html.includes(emphasizeEasing(curve.cubic, .6).map(value => value.toFixed(2)).join(', ')))
  }
})

it('renders engine-supplied steps and clipboard feedback', async () => {
  const { MotionSteps } = await server.ssrLoadModule('/src/workspaces/motion/MotionSteps.tsx')
  for (const copied of [false, true]) {
    const html = renderToStaticMarkup(createElement(MotionSteps, {
      motionResult: result, copied, copyMotionData: async () => {},
    }))
    for (const step of result.steps) {
      assert.ok(html.includes(step.title))
      assert.ok(html.includes(step.description))
      if (step.channel) {
        assert.ok(html.includes(`data-channel="${step.channel}"><span>${String(step.index).padStart(2, '0')}</span><div><h3>${step.title}</h3>`))
      }
    }
    assert.ok(html.includes(copied ? 'Copied keyframes' : 'Copy keyframe values'))
  }
})

it('keeps overshooting handle markers and guide lines inside the graph while retaining curve values', async () => {
  const { RecordedGraph } = await server.ssrLoadModule('/src/components/RecordedGraph.tsx')
  const curve = { ...result.curves[0], cubic: [.33, 1.36, .67, -.2] }
  const html = renderToStaticMarkup(createElement(RecordedGraph, { curve }))
  assert.doesNotMatch(html, /type="range"|Curve emphasis/)
  const markers = [...html.matchAll(/class="curve-handle"[^>]*cy="([^"]+)"/g)]
  assert.deepEqual(markers.map(match => Number(match[1])), [18, 146])
  const guides = [...html.matchAll(/class="handle-line"[^>]*y2="([^"]+)"/g)]
  assert.deepEqual(guides.map(match => Number(match[1])), [18, 146])
  assert.ok(html.includes('0.33, 1.50, 0.67, -0.50'))
  assert.match(html, /C 112\.48 -46, 199\.52 210/)
})

it('uses emphasized handles for short intervals and original handles for long intervals', async () => {
  const { RecordedGraph } = await server.ssrLoadModule('/src/components/RecordedGraph.tsx')
  for (const [duration, strength] of [[1.23, .6], [3, 0]]) {
    const curve = { ...result.curves[0], startTime: 5, endTime: 5 + duration, cubic: [.33, .96, .67, .51] as [number, number, number, number] }
    const html = renderToStaticMarkup(createElement(RecordedGraph, { curve }))
    assert.doesNotMatch(html, /type="range"|Curve emphasis/)
    assert.ok(html.includes('stroke:var(--position-curve)'))
    assert.ok(html.includes(emphasizeEasing(curve.cubic, strength).map(value => value.toFixed(2)).join(', ')))
  }
})

it('renders two linear graphs for a constant-speed right-angle turn', async () => {
  const { MotionGraphs } = await server.ssrLoadModule('/src/workspaces/motion/MotionGraphs.tsx')
  const motionResult = buildMotionResult([[0, 0], [10, 0], [20, 0], [20, 10], [20, 20]].map(([x, y], i) => ({ time: i * .1, x, y, rotation: 0 })))
  const html = renderToStaticMarkup(createElement(MotionGraphs, {
    motionResult, curveChannel: 'position', setCurveChannel: () => {}, onShowSteps: () => {},
  }))
  assert.equal([...html.matchAll(/class="easing-card"/g)].length, 2)
  assert.equal([...html.matchAll(/0.33, 0.33, 0.67, 0.67/g)].length, 2)
})

it('provides an accessible shape color dropdown that can be disabled during capture', async () => {
  const { ShapeColorPicker } = await server.ssrLoadModule('/src/components/ShapeColorPicker.tsx')
  for (const disabled of [true, false]) {
    const html = renderToStaticMarkup(createElement(ShapeColorPicker, { value: '#000000', onChange() {}, disabled }))
    assert.match(html, /aria-label="Shape color"/)
    assert.match(html, /aria-expanded="false"/)
    assert.equal(html.includes('disabled=""'), disabled)
  }
})

it('omits the placeholder project title and saved status from the header', async () => {
  const { ProjectHeader } = await server.ssrLoadModule('/src/components/layout/ProjectHeader.tsx')
  const html = renderToStaticMarkup(createElement(ProjectHeader))
  assert.doesNotMatch(html, /MY PROJECTS|Untitled motion|Saved/)
  assert.match(html, /Export guide/)
})
