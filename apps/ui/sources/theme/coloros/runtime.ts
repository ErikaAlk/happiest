// 从 coloros-ui-kit 978d318 的 web/runtime.ts 同步，不要手改；运行 yarn sync:coloros-tokens 更新。
// tokens.g.ts 的配套类型与换算，与 android/kit 的 Runtime.kt、flutter/lib/src/runtime.dart 同一套规则。
// 手写，不由生成器产生。

/** 分亮暗的 token 值。 */
export type Themed<T> = Readonly<{ light: T; dark: T }>;

export function themedValue<T>(value: Themed<T>, dark: boolean): T {
  return dark ? value.dark : value.light;
}

/** COUI 弹簧：阻尼比 = 1 − bounce，刚度 = (2π / response)²，质量 1。 */
export type CoSpring = Readonly<{ bounce: number; response: number }>;

export type CoSpringPhysics = Readonly<{ mass: 1; stiffness: number; damping: number; dampingRatio: number }>;

export function coSpringPhysics(spring: CoSpring): CoSpringPhysics {
  const period = spring.response === 0 ? 1 : spring.response;
  const stiffness = (2 * Math.PI / period) ** 2;
  const dampingRatio = 1 - spring.bounce;
  return { mass: 1, stiffness, damping: 2 * dampingRatio * Math.sqrt(stiffness), dampingRatio };
}

/** 字体档位（逻辑像素）。 */
export type CoTypeStyle = Readonly<{ size: number; lineHeight: number; weight: number }>;
