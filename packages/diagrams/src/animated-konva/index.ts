/* eslint-disable @typescript-eslint/no-explicit-any */
import { animated, type AnimatedProps } from '@react-spring/konva'
import { Rect, Stage, Text, Group, Path, Line, Layer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaNodeComponent, StageProps } from 'react-konva'

export {
  Layer,
  Text
}

export const AnimatedStage: KonvaNodeComponent<Konva.Stage, AnimatedProps<StageProps>> = animated(Stage) as any
export const AnimatedRect: KonvaNodeComponent<Konva.Rect, AnimatedProps<Konva.RectConfig>> = animated(Rect) as any
export const AnimatedGroup: KonvaNodeComponent<Konva.Group, AnimatedProps<Konva.GroupConfig>> = animated(Group) as any
export const AnimatedText: KonvaNodeComponent<Konva.Text, AnimatedProps<Konva.TextConfig>> = animated(Text) as any
export const AnimatedPath: KonvaNodeComponent<Konva.Path, AnimatedProps<Konva.PathConfig>> = animated(Path) as any
export const AnimatedLine: KonvaNodeComponent<Konva.Line, AnimatedProps<Konva.LineConfig>> = animated(Line) as any
