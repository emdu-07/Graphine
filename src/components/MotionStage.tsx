import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { MotionObject } from '../types'

interface MotionStageProps {
  object: MotionObject
  onChange: (next: MotionObject) => void
  previewPosition?: { x: number; y: number; rotation: number }
  countdown?: number | null
  recording?: boolean
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 760, height: 520 })
  useLayoutEffect(() => {
    if (!ref.current) return
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

export function MotionStage({ object, onChange, previewPosition, countdown, recording }: MotionStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shapeRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const size = useContainerSize(containerRef)
  const image = LoadedImage({ src: object.imageUrl })
  const display = previewPosition ?? object

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

  return (
    <div className="stage-container" ref={containerRef}>
      <Stage width={size.width} height={size.height}>
        <Layer listening={false}>
          {Array.from({ length: Math.ceil(size.width / 40) }).map((_, index) => (
            <Line key={`v-${index}`} points={[index * 40, 0, index * 40, size.height]} stroke="#223039" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.ceil(size.height / 40) }).map((_, index) => (
            <Line key={`h-${index}`} points={[0, index * 40, size.width, index * 40]} stroke="#223039" strokeWidth={1} />
          ))}
          <Line
            points={[object.startX + object.width / 2, object.startY + object.height / 2, endX + object.width / 2, endY + object.height / 2]}
            stroke="#63727a"
            strokeWidth={1.5}
            dash={[7, 8]}
          />
          <Circle x={object.startX + object.width / 2} y={object.startY + object.height / 2} radius={5} fill="#0f171c" stroke="#93a1a9" />
          <Circle x={endX + object.width / 2} y={endY + object.height / 2} radius={5} fill="#b8ffd9" stroke="#0f171c" />
          <Text x={object.startX - 8} y={object.startY + object.height + 13} text="START" fill="#75838b" fontSize={10} fontFamily="DM Sans" />
          <Text x={endX - 2} y={endY + object.height + 13} text="END" fill="#8de8ba" fontSize={10} fontFamily="DM Sans" />
        </Layer>
        <Layer>
          <Group
            ref={shapeRef}
            x={display.x}
            y={display.y}
            rotation={display.rotation}
            draggable={!previewPosition}
            onDragMove={(event) => onChange({ ...object, x: event.target.x(), y: event.target.y() })}
            onDragEnd={(event) => onChange({ ...object, x: event.target.x(), y: event.target.y() })}
            onTransform={(event) => onChange({ ...object, x: event.target.x(), y: event.target.y(), rotation: event.target.rotation() })}
            onTransformEnd={commitTransform}
          >
            <Rect width={object.width} height={object.height} fill="#000" opacity={0.18} cornerRadius={24} x={8} y={10} listening={false} />
            {renderShape()}
          </Group>
          {!previewPosition && (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              borderStroke="#b8ffd9"
              borderStrokeWidth={1.5}
              anchorFill="#b8ffd9"
              anchorStroke="#10191e"
              anchorSize={10}
              anchorCornerRadius={5}
              rotateAnchorOffset={28}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              boundBoxFunc={(oldBox, newBox) => newBox.width < 48 || newBox.height < 48 ? oldBox : newBox}
            />
          )}
        </Layer>
      </Stage>
      {countdown !== null && countdown !== undefined && (
        <div className="countdown-overlay"><span>GET READY</span><strong key={countdown}>{countdown}</strong><small>Grab the object when recording starts</small></div>
      )}
      {recording && <div className="recording-indicator"><i /> RECORDING MOVEMENT</div>}
      <div className="stage-hint">Drag to position · Handles resize · Top handle rotates</div>
    </div>
  )
}
