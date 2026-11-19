/**
 * Shim de animações — API `framer-motion` para React Native.
 *
 * Espelha o subconjunto usado pelo app (initial/animate/exit/transition +
 * AnimatePresence mode="wait"). A versão web (`motion.web.ts`) é o
 * framer-motion real; esta nativa usa Reanimated 4.
 *
 * Alvos numéricos suportados: opacity, x, y, scale, height, width.
 * Componentes `motion.*` de SVG ficam estáticos (target final sem animação).
 */
import React, {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Circle, Line, Path, Rect } from 'react-native-svg';

export type MotionTarget = {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  height?: number;
  width?: number;
  [key: string]: string | number | undefined;
};

export type MotionTransition = {
  duration?: number;
  delay?: number;
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  type?: 'spring' | 'tween';
  stiffness?: number;
  damping?: number;
  mass?: number;
};

export type MotionProps = {
  initial?: MotionTarget;
  animate?: MotionTarget;
  exit?: MotionTarget;
  transition?: MotionTransition;
  __exit?: boolean;
  __motionKey?: string;
};

type ExitDoneFn = (key: string) => void;
type NumSV = { value: number | undefined };

const AnimatePresenceContext = createContext<ExitDoneFn | null>(null);

const EASINGS = {
  linear: Easing.linear,
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),
} as const;

function buildAnimation(
  to: number,
  transition: MotionTransition | undefined,
  onDone?: () => void,
) {
  const durationMs = (transition?.duration ?? 0.3) * 1000;
  if (transition?.type === 'spring') {
    return withSpring(
      to,
      {
        stiffness: transition.stiffness ?? 300,
        damping: transition.damping ?? 25,
        mass: transition.mass ?? 1,
      },
      (finished) => {
        'worklet';
        if (finished && onDone) onDone();
      },
    );
  }
  return withTiming(
    to,
    { duration: durationMs, easing: EASINGS[transition?.ease ?? 'easeOut'] },
    (finished) => {
      'worklet';
      if (finished && onDone) onDone();
    },
  );
}

function runAnimation(
  value: NumSV,
  to: number,
  transition: MotionTransition | undefined,
  onDone?: () => void,
): void {
  const delayMs = (transition?.delay ?? 0) * 1000;
  if (delayMs > 0) {
    value.value = withDelay(delayMs, buildAnimation(to, transition, onDone));
  } else {
    value.value = buildAnimation(to, transition, onDone);
  }
}

function shallowEqualTargets(
  a: MotionTarget | undefined,
  b: MotionTarget | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

type MotionComponentProps<P> = P &
  MotionProps & {
    children?: ReactNode;
    className?: string;
    style?: unknown;
  };

function pairsOf(
  target: MotionTarget,
  values: {
    opacity: NumSV;
    tx: NumSV;
    ty: NumSV;
    scale: NumSV;
    height: NumSV;
    width: NumSV;
  },
): [NumSV, number][] {
  const pairs: [NumSV, number][] = [];
  if (target.opacity !== undefined) pairs.push([values.opacity, target.opacity]);
  if (target.x !== undefined) pairs.push([values.tx, target.x]);
  if (target.y !== undefined) pairs.push([values.ty, target.y]);
  if (target.scale !== undefined) pairs.push([values.scale, target.scale]);
  if (target.height !== undefined) pairs.push([values.height, target.height]);
  if (target.width !== undefined) pairs.push([values.width, target.width]);
  return pairs;
}

function createMotionComponent<P extends object>(
  Base: React.ComponentType<P>,
): React.ComponentType<MotionComponentProps<P>> {
  type LooseProps = Record<string, unknown> & { style?: unknown; children?: ReactNode };
  const AnimatedBase = Animated.createAnimatedComponent(
    Base as unknown as React.ComponentType<LooseProps>,
  );

  function MotionComponent(props: MotionComponentProps<P>) {
    const { initial, animate, exit, transition, __exit, __motionKey, style, ...rest } =
      props;
    const onExitDone = useContext(AnimatePresenceContext);
    const exiting = Boolean(__exit);

    const opacity = useSharedValue(initial?.opacity ?? animate?.opacity ?? 1);
    const tx = useSharedValue(initial?.x ?? animate?.x ?? 0);
    const ty = useSharedValue(initial?.y ?? animate?.y ?? 0);
    const scale = useSharedValue(initial?.scale ?? animate?.scale ?? 1);
    const height = useSharedValue(initial?.height ?? animate?.height);
    const width = useSharedValue(initial?.width ?? animate?.width);
    const values = { opacity, tx, ty, scale, height, width };

    const prevAnimate = useRef<MotionTarget | undefined>(animate);
    const didEnter = useRef(false);

    useEffect(() => {
      if (exiting) {
        if (exit) {
          const pairs = pairsOf(exit, values);
          if (pairs.length === 0) {
            onExitDone?.(__motionKey ?? '');
          } else {
            let pending = pairs.length;
            let completed = 0;
            for (const [value, target] of pairs) {
              runAnimation(value, target, transition, () => {
                completed += 1;
                if (completed >= pending) onExitDone?.(__motionKey ?? '');
              });
            }
          }
        } else {
          onExitDone?.(__motionKey ?? '');
        }
        return;
      }

      if (!didEnter.current) {
        didEnter.current = true;
        if (initial && animate) {
          for (const [value, target] of pairsOf(animate, values)) {
            if (value.value !== target) runAnimation(value, target, transition);
          }
        }
        return;
      }

      if (animate && !shallowEqualTargets(animate, prevAnimate.current)) {
        prevAnimate.current = animate;
        for (const [value, target] of pairsOf(animate, values)) {
          if (value.value !== target) runAnimation(value, target, transition);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exiting, animate, exit]);

    const animatedStyle = useAnimatedStyle(() => {
      const computed: Record<string, unknown> = {
        opacity: opacity.value,
        transform: [
          { translateX: tx.value },
          { translateY: ty.value },
          { scale: scale.value },
        ],
      };
      if (height.value !== undefined) computed.height = height.value;
      if (width.value !== undefined) computed.width = width.value;
      return computed;
    });

    return (
      <AnimatedBase
        {...(rest as unknown as LooseProps)}
        style={[animatedStyle, ...(Array.isArray(style) ? style : [style])]}
      />
    );
  }
  MotionComponent.displayName = 'MotionComponent';
  return MotionComponent;
}

function createStaticSvgMotionComponent<P extends object>(
  Base: React.ComponentType<P>,
): React.ComponentType<MotionComponentProps<P>> {
  function SvgMotionComponent(props: MotionComponentProps<P>) {
    const { initial, animate, exit, transition, __exit, __motionKey, ...rest } =
      props;
    void transition;
    void __exit;
    void __motionKey;
    void initial;
    void exit;
    const target = animate ?? initial ?? exit ?? {};
    const staticProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target)) {
      if (value !== undefined) staticProps[key] = value;
    }
    return <Base {...(rest as unknown as P)} {...(staticProps as Partial<P>)} />;
  }
  SvgMotionComponent.displayName = 'MotionSvgComponent';
  return SvgMotionComponent;
}

export const motion = {
  div: createMotionComponent(View as React.ComponentType<ViewProps>),
  p: createMotionComponent(Text as unknown as React.ComponentType<TextProps>),
  span: createMotionComponent(Text as unknown as React.ComponentType<TextProps>),
  text: createMotionComponent(Text as unknown as React.ComponentType<TextProps>),
  section: createMotionComponent(View as React.ComponentType<ViewProps>),
  main: createMotionComponent(View as React.ComponentType<ViewProps>),
  header: createMotionComponent(View as React.ComponentType<ViewProps>),
  footer: createMotionComponent(View as React.ComponentType<ViewProps>),
  aside: createMotionComponent(View as React.ComponentType<ViewProps>),
  nav: createMotionComponent(View as React.ComponentType<ViewProps>),
  ul: createMotionComponent(View as React.ComponentType<ViewProps>),
  li: createMotionComponent(View as React.ComponentType<ViewProps>),
  button: createMotionComponent(View as React.ComponentType<ViewProps>),
  circle: createStaticSvgMotionComponent(
    Circle as unknown as React.ComponentType<Record<string, unknown>>,
  ),
  rect: createStaticSvgMotionComponent(
    Rect as unknown as React.ComponentType<Record<string, unknown>>,
  ),
  path: createStaticSvgMotionComponent(
    Path as unknown as React.ComponentType<Record<string, unknown>>,
  ),
  line: createStaticSvgMotionComponent(
    Line as unknown as React.ComponentType<Record<string, unknown>>,
  ),
};

export type AnimatePresenceProps = {
  children?: ReactNode;
  mode?: 'wait' | 'sync' | 'popLayout';
};

export function AnimatePresence({ children, mode }: AnimatePresenceProps) {
  const isWait = mode === 'wait';
  const incoming = useMemo(
    () => Children.toArray(children).filter(isValidElement) as ReactElement[],
    [children],
  );
  const [rendered, setRendered] = useState<ReactElement[]>(incoming);
  const [exitingKeys, setExitingKeys] = useState<string[]>([]);
  const incomingRef = useRef<ReactElement[]>(incoming);
  incomingRef.current = incoming;

  const keyOf = (child: ReactElement) => String(child.key);

  useEffect(() => {
    const renderedKeys = new Set(rendered.map(keyOf));
    const incomingKeys = new Set(incoming.map(keyOf));
    const gone = [...renderedKeys].filter((k) => !incomingKeys.has(k));

    if (gone.length > 0) {
      setExitingKeys((curr) => [...curr, ...gone.filter((k) => !curr.includes(k))]);
      if (!isWait) {
        const goneSet = new Set(gone);
        const added = incoming.filter((c) => !renderedKeys.has(keyOf(c)));
        setRendered([...rendered.filter((c) => !goneSet.has(keyOf(c))), ...added]);
      }
      return;
    }

    if (isWait && exitingKeys.length > 0) return;

    const changed =
      incoming.length !== rendered.length ||
      incoming.some((c, i) => keyOf(c) !== keyOf(rendered[i] ?? ({ key: null } as ReactElement)));
    if (changed) setRendered(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  useEffect(() => {
    if (exitingKeys.length > 0) return;
    const incomingKeys = new Set(incomingRef.current.map(keyOf));
    const renderedKeys = new Set(rendered.map(keyOf));
    const stale = rendered.some(
      (c) => !incomingKeys.has(keyOf(c)) && !exitingKeys.includes(keyOf(c)),
    );
    const added = incomingRef.current.some((c) => !renderedKeys.has(keyOf(c)));
    if (stale || added) setRendered(incomingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitingKeys]);

  const handleExitDone = (key: string) => {
    setExitingKeys((curr) => curr.filter((k) => k !== key));
    setRendered((curr) => curr.filter((c) => keyOf(c) !== key));
  };

  const content = rendered.map((child) =>
    cloneElement(child as ReactElement<Record<string, unknown>>, {
      __exit: exitingKeys.includes(keyOf(child)),
      __motionKey: keyOf(child),
    }),
  );

  return (
    <AnimatePresenceContext.Provider value={handleExitDone}>
      {content}
    </AnimatePresenceContext.Provider>
  );
}
