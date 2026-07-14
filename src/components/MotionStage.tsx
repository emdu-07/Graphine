import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { MotionObject, MotionSample } from '../types'

interface MotionStageProps {
  object: MotionObject
  onChange: (next: MotionObject) => void
  previewPosition?: { x: number; y: number; rotation: number }
  countdown?: number | null
  recording?: boolean
  motionPath?: MotionSample[]
}

const WORLD_WIDTH = 2000
const WORLD_HEIGHT = 1400
const MIN_ZOOM = .35
const MAX_ZOOM = 3

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 760, height: 520 })
  useLayoutEffect(() => {
    if (!ref.current) return
    const bounds = ref.current.getBoundingClientRect()
    setSize({ width: bounds.width, height: bounds.height })
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return size
}

function LoadedImage({ src }: { src?: string }) {
  const [image, setImage] = useState<HTMLImageElement>()
  useEffect(() => {
    if (!src) return
    const next = new window.Image()
    next.onload = () => setImage(next)
    next.src = src
  }, [src])
  return image
}

export function MotionStage({ object, onChange, previewPosition, countdown, recording, motionPath = [] }: MotionStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shapeRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const size = useContainerSize(containerRef)
  const image = LoadedImage({ src: object.imageUrl })
  const display = previewPosition ?? object
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const [activeSnap, setActiveSnap] = useState<'horizontal' | 'vertical' | null>(null)
  const hasCentered = useRef(false)
  const dragMotion = useRef<{
    originX: number
    originY: number
    filteredX: number
    filteredY: number
    rawX: number
    rawY: number
    snap: 'horizontal' | 'vertical' | null
  } | null>(null)
  const filteredRotation = useRef<number | null>(null)

  const clampPosition = useCallback((position: { x: number; y: number }) => {
    const padding = 12
    return {
      x: Math.min(Math.max(position.x, padding), WORLD_WIDTH - object.width - padding),
      y: Math.min(Math.max(position.y, padding), WORLD_HEIGHT - object.height - padding),
    }
  }, [object.width, object.height])

  const boundShapeDrag = useCallback((absolutePosition: { x: number; y: number }) => {
    const parent = shapeRef.current?.getParent()
    if (!parent) return absolutePosition
    const parentTransform = parent.getAbsoluteTransform()
    const localPosition = parentTransform.copy().invert().point(absolutePosition)
    return parentTransform.point(clampPosition(localPosition))
  }, [clampPosition])

  const clampViewport = useCallback((next: { x: number; y: number; scale: number }) => {
    const scaledWidth = WORLD_WIDTH * next.scale
    const scaledHeight = WORLD_HEIGHT * next.scale
    const x = scaledWidth <= size.width
      ? (size.width - scaledWidth) / 2
      : Math.min(0, Math.max(size.width - scaledWidth, next.x))
    const y = scaledHeight <= size.height
      ? (size.height - scaledHeight) / 2
      : Math.min(0, Math.max(size.height - scaledHeight, next.y))
    return { ...next, x, y }
  }, [size.width, size.height])

  const centerOnObject = useCallback(() => {
    const scale = 1
    setViewport(clampViewport({
      scale,
      x: size.width / 2 - (object.x + object.width / 2) * scale,
      y: size.height / 2 - (object.y + object.height / 2) * scale,
    }))
  }, [clampViewport, object.x, object.y, object.width, object.height, size.width, size.height])

  useEffect(() => {
    if (!hasCentered.current && size.width > 0 && size.height > 0) {
      centerOnObject()
      hasCentered.current = true
    }
  }, [centerOnObject, size.width, size.height])

  const zoomAt = (point: { x: number; y: number }, requestedScale: number) => {
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedScale))
    const worldPoint = {
      x: (point.x - viewport.x) / viewport.scale,
      y: (point.y - viewport.y) / viewport.scale,
    }
    setViewport(clampViewport({
      scale,
      x: point.x - worldPoint.x * scale,
      y: point.y - worldPoint.y * scale,
    }))
  }

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    if (event.evt.ctrlKey || event.evt.metaKey) {
      const pointer = event.target.getStage()?.getPointerPosition()
      if (!pointer) return
      zoomAt(pointer, viewport.scale * Math.exp(-event.evt.deltaY * .01))
      return
    }
    setViewport(current => clampViewport({
      ...current,
      x: current.x - event.evt.deltaX,
      y: current.y - event.evt.deltaY,
    }))
  }

  const zoomFromCenter = (factor: number) => {
    zoomAt({ x: size.width / 2, y: size.height / 2 }, viewport.scale * factor)
  }

  useEffect(() => {
    if (shapeRef.current && transformerRef.current) {
      transformerRef.current.nodes([shapeRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [object.kind])

  const commitTransform = () => {
    const node = shapeRef.current
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onChange({
      ...object,
      x: node.x(),
      y: node.y(),
      width: Math.max(48, object.width * scaleX),
      height: Math.max(48, object.height * scaleY),
      rotation: node.rotation(),
    })
  }

  const beginDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    const x = event.target.x()
    const y = event.target.y()
    dragMotion.current = { originX: x, originY: y, filteredX: x, filteredY: y, rawX: x, rawY: y, snap: null }
    setActiveSnap(null)
  }

  const stabilizeDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    const state = dragMotion.current
    if (!state) return
    const rawX = event.target.x()
    const rawY = event.target.y()
    const deltaX = rawX - state.originX
    const deltaY = rawY - state.originY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    let snap = state.snap

    if (snap === 'horizontal' && absY > Math.max(24, absX * .22)) snap = null
    if (snap === 'vertical' && absX > Math.max(24, absY * .22)) snap = null
    if (!snap && Math.max(absX, absY) > 28) {
      if (absY <= Math.max(7, absX * .11)) snap = 'horizontal'
      else if (absX <= Math.max(7, absY * .11)) snap = 'vertical'
    }

    const targetX = snap === 'vertical' ? state.originX : rawX
    const targetY = snap === 'horizontal' ? state.originY : rawY
    const smoothing = .38
    const filteredX = snap === 'vertical' ? state.originX : state.filteredX + (targetX - state.filteredX) * smoothing
    const filteredY = snap === 'horizontal' ? state.originY : state.filteredY + (targetY - state.filteredY) * smoothing

    event.target.position({ x: filteredX, y: filteredY })
    dragMotion.current = { ...state, filteredX, filteredY, rawX, rawY, snap }
    if (snap !== state.snap) setActiveSnap(snap)
    onChange({ ...object, x: filteredX, y: filteredY })
  }

  const finishDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    onChange({ ...object, x: event.target.x(), y: event.target.y() })
    dragMotion.current = null
    setActiveSnap(null)
  }

  const beginRotation = (event: Konva.KonvaEventObject<Event>) => {
    filteredRotation.current = event.target.rotation()
  }

  const stabilizeTransform = (event: Konva.KonvaEventObject<Event>) => {
    const rawRotation = event.target.rotation()
    const previous = filteredRotation.current ?? rawRotation
    const shortestDelta = ((rawRotation - previous + 540) % 360) - 180
    const rotation = previous + shortestDelta * .42
    filteredRotation.current = rotation
    event.target.rotation(rotation)
    onChange({ ...object, x: event.target.x(), y: event.target.y(), rotation })
  }

  const renderShape = () => {
    if (object.kind === 'image' && image) {
      return <KonvaImage image={image} width={object.width} height={object.height} cornerRadius={18} />
    }
    if (object.kind === 'circle') {
      return <Circle x={object.width / 2} y={object.height / 2} radius={Math.min(object.width, object.height) / 2} fill={object.fill} />
    }
    if (object.kind === 'triangle') {
      return <Line points={[object.width / 2, 0, object.width, object.height, 0, object.height]} closed fill={object.fill} lineJoin="round" />
    }
    return <Rect width={object.width} height={object.height} fill={object.fill} cornerRadius={24} />
  }

  const endX = object.x
  const endY = object.y
  const centerAt = (x: number, y: number, rotation: number) => {
    const radians = rotation * Math.PI / 180
    const halfWidth = object.width / 2
    const halfHeight = object.height / 2
    return {
      x: x + halfWidth * Math.cos(radians) - halfHeight * Math.sin(radians),
      y: y + halfWidth * Math.sin(radians) + halfHeight * Math.cos(radians),
    }
  }
  const startCenter = centerAt(object.startX, object.startY, motionPath[0]?.rotation ?? object.rotation)
  const endCenter = centerAt(endX, endY, object.rotation)
  const trailPoints = motionPath.length > 1
    ? motionPath.flatMap(sample => {
        const center = centerAt(sample.x, sample.y, sample.rotation)
        return [center.x, center.y]
      })
    : [startCenter.x, startCenter.y, endCenter.x, endCenter.y]

  return (
    <div className="stage-container" ref={containerRef}>
      <Stage width={size.width} height={size.height} onWheel={handleWheel}>
        <Layer listening={false}>
          <Group x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
            <Rect width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="#111b20" stroke="#334149" strokeWidth={1 / viewport.scale} />
            {Array.from({ length: Math.ceil(WORLD_WIDTH / 40) + 1 }).map((_, index) => (
              <Line key={`v-${index}`} points={[index * 40, 0, index * 40, WORLD_HEIGHT]} stroke="#223039" strokeWidth={1 / viewport.scale} />
            ))}
            {Array.from({ length: Math.ceil(WORLD_HEIGHT / 40) + 1 }).map((_, index) => (
              <Line key={`h-${index}`} points={[0, index * 40, WORLD_WIDTH, index * 40]} stroke="#223039" strokeWidth={1 / viewport.scale} />
            ))}
            {activeSnap === 'horizontal' && <Line points={[0, dragMotion.current?.originY ?? object.y, WORLD_WIDTH, dragMotion.current?.originY ?? object.y]} stroke="#b8ffd9" opacity={.55} strokeWidth={1 / viewport.scale} dash={[5 / viewport.scale, 6 / viewport.scale]} />}
            {activeSnap === 'vertical' && <Line points={[dragMotion.current?.originX ?? object.x, 0, dragMotion.current?.originX ?? object.x, WORLD_HEIGHT]} stroke="#b8ffd9" opacity={.55} strokeWidth={1 / viewport.scale} dash={[5 / viewport.scale, 6 / viewport.scale]} />}
            <Line
              points={trailPoints}
              stroke="#63727a"
              strokeWidth={1.5 / viewport.scale}
              dash={[7 / viewport.scale, 8 / viewport.scale]}
              tension={motionPath.length > 2 ? .18 : 0}
              lineCap="round"
              lineJoin="round"
            />
            <Circle x={startCenter.x} y={startCenter.y} radius={5 / viewport.scale} fill="#0f171c" stroke="#93a1a9" />
            <Circle x={endCenter.x} y={endCenter.y} radius={5 / viewport.scale} fill="#b8ffd9" stroke="#0f171c" />
            <Text x={object.startX - 8} y={object.startY + object.height + 13} text="START" fill="#75838b" fontSize={10 / viewport.scale} fontFamily="DM Sans" />
            <Text x={endX - 2} y={endY + object.height + 13} text="END" fill="#8de8ba" fontSize={10 / viewport.scale} fontFamily="DM Sans" />
          </Group>
        </Layer>
        <Layer>
          <Group x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
            <Group
              ref={shapeRef}
              x={display.x}
              y={display.y}
              rotation={display.rotation}
              draggable={!previewPosition}
              dragBoundFunc={boundShapeDrag}
              onDragStart={beginDrag}
              onDragMove={stabilizeDrag}
              onDragEnd={finishDrag}
              onTransformStart={beginRotation}
              onTransform={stabilizeTransform}
              onTransformEnd={() => { filteredRotation.current = null; commitTransform() }}
            >
              <Rect width={object.width} height={object.height} fill="#000" opacity={0.18} cornerRadius={24} x={8} y={10} listening={false} />
              {renderShape()}
            </Group>
            {!previewPosition && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke="#b8ffd9"
                borderStrokeWidth={1.5 / viewport.scale}
                anchorFill="#b8ffd9"
                anchorStroke="#10191e"
                anchorSize={10 / viewport.scale}
                anchorCornerRadius={5 / viewport.scale}
                rotateAnchorOffset={28 / viewport.scale}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                boundBoxFunc={(oldBox, newBox) => newBox.width < 48 || newBox.height < 48 ? oldBox : newBox}
              />
            )}
          </Group>
        </Layer>
      </Stage>
      {countdown !== null && countdown !== undefined && (
        <div className="countdown-overlay"><span>GET READY</span><strong key={countdown}>{countdown}</strong><small>Grab the object when recording starts</small></div>
      )}
      {recording && <div className="recording-indicator"><i /> RECORDING MOVEMENT</div>}
      <div className="viewport-controls" aria-label="Canvas zoom controls">
        <button onClick={() => zoomFromCenter(.8)} title="Zoom out"><Minus size={13} /></button>
        <span>{Math.round(viewport.scale * 100)}%</span>
        <button onClick={() => zoomFromCenter(1.25)} title="Zoom in"><Plus size={13} /></button>
        <button onClick={centerOnObject} title="Center object"><LocateFixed size={13} /></button>
      </div>
      <div className="stage-hint">Two-finger scroll to pan · Pinch to zoom · Drag object to move</div>
    </div>
  )
}
