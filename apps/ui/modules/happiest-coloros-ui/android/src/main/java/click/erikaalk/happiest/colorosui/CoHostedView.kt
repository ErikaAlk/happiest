package click.erikaalk.happiest.colorosui

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Recomposer
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.currentRecomposeScope
import androidx.compose.runtime.key
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.createLifecycleAwareWindowRecomposer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.lifecycle.LifecycleOwner
import click.erikaalk.coloroskit.CoTheme
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ComposableScope
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.ExpoComposeView
import java.util.EnumSet
import java.util.WeakHashMap

/**
 * 每个原生控件都带的环境属性，由 React Native 侧按应用当前状态传入：
 * 深浅色、应用内字号缩放（乘在系统字号上）、减少动态、无障碍标签（已经过 t(...)）。
 */
interface CoHostedProps : ComposeProps {
  val dark: MutableState<Boolean>
  val fontScale: MutableState<Float>
  val reduceMotion: MutableState<Boolean>
  val accessibilityText: MutableState<String?>
}

/**
 * 设计库组件的动画时长倍率。减少动态打开时为 0（动画直接到终点），否则跟随系统的动画时长缩放。
 * 减少动态是宿主级的偏好，所有原生控件共用一份。
 */
internal object CoMotionDurationScale : MotionDurationScale {
  @Volatile
  var reduceMotion = false

  @Volatile
  private var systemScale = 1f
  private var observing = false

  override val scaleFactor: Float
    get() = if (reduceMotion) 0f else systemScale

  fun observeSystemScale(context: Context) {
    if (observing) return
    observing = true
    val resolver = context.applicationContext.contentResolver
    val read = { systemScale = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) }
    read()
    resolver.registerContentObserver(
      Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
      false,
      object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) = read()
      }
    )
  }
}

/**
 * 原生控件的组合都挂在每个 Activity 一份的 Recomposer 上，它的协程上下文带 [CoMotionDurationScale]，
 * 设计库里的弹簧、过渡与循环动画因此都受减少动态控制；随 Activity 生命周期暂停与结束。
 */
internal object CoCompositionContexts {
  private val recomposers = WeakHashMap<Activity, Recomposer>()

  fun of(activity: Activity): Recomposer {
    CoMotionDurationScale.observeSystemScale(activity)
    return recomposers.getOrPut(activity) {
      val lifecycle = (activity as LifecycleOwner).lifecycle
      activity.window.decorView.createLifecycleAwareWindowRecomposer(CoMotionDurationScale, lifecycle)
    }
  }
}

/** 在离屏图层里把内容中不透明的像素换成 [color]（单色图标上色）。 */
internal fun Modifier.coTint(color: Color): Modifier =
  graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
    .drawWithContent {
      drawContent()
      drawRect(color, blendMode = BlendMode.SrcIn)
    }

/**
 * 承载一个设计库控件的原生视图。组合内容包在 [CoTheme] 里，量出的尺寸写回 React Native 的布局
 * （[autoSize] 里的方向由内容决定，其余方向跟随 React Native 的样式）。
 */
@SuppressLint("ViewConstructor")
abstract class CoHostedView<P : CoHostedProps>(
  context: Context,
  appContext: AppContext
) : ExpoComposeView<P>(context, appContext, withHostingView = true) {
  abstract override val props: P

  /** 由内容决定尺寸的方向；组合时读取，可以随属性变化。 */
  protected abstract val autoSize: EnumSet<Direction>

  init {
    val activity = requireNotNull(appContext.currentActivity) { "原生控件创建时没有当前 Activity" }
    (getChildAt(0) as ComposeView).setParentCompositionContext(CoCompositionContexts.of(activity))
  }

  @Composable
  protected abstract fun Hosted(modifier: Modifier)

  /**
   * 把第 [index] 个 React Native 子视图画进设计库组件的槽位。子视图是 `@expo/ui` 的 `RNHostView`
   * （matchContents，尺寸取 React Native 布局量出的大小），按 React 子节点顺序数，不含本视图自己的 ComposeView。
   * [tint] 不为空时把子视图里不透明的像素都染成这个颜色（图标跟随设计库给的选中色、禁用色）。
   *
   * 子视图只显示、不接触摸：`RNHostView` 把 React Native 视图包在一个消费全部触摸的容器里，落在图标上的点按会被它吃掉，
   * 外层设计库控件的 clickable 收不到。所以在它上面叠一个同尺寸、只接收不消费的指针节点：Compose 只把指针交给重叠兄弟节点里
   * 最上面的一个，React Native 视图收不到，外层控件照常收到未被消费的事件。
   */
  @Composable
  protected fun ReactChild(index: Int, tint: Color? = null) {
    recomposeScope = currentRecomposeScope
    val child = (0 until childCount)
      .map { getChildAt(it) }
      .filterIsInstance<ExpoComposeView<*>>()
      .filterNot { it.shouldUseAndroidLayout }
      .getOrNull(index) ?: return
    key(child) {
      Box(if (tint == null) Modifier else Modifier.coTint(tint)) {
        with(ComposableScope()) { with(child) { Content() } }
        Box(Modifier.matchParentSize().pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } })
      }
    }
  }

  @Composable
  override fun ComposableScope.Content() {
    val reduceMotion = props.reduceMotion.value
    SideEffect { CoMotionDurationScale.reduceMotion = reduceMotion }
    val label = props.accessibilityText.value
    val base = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(base.density, base.fontScale * props.fontScale.value)) {
      CoTheme(dark = props.dark.value) {
        MeasuredSize {
          Hosted(if (label == null) Modifier else Modifier.semantics { contentDescription = label })
        }
      }
    }
  }

  private var reportedWidth = Double.NaN
  private var reportedHeight = Double.NaN

  /**
   * 在 [autoSize] 的方向上不设上限地实际测量一次内容，把量出的 dp 尺寸写回 React Native 布局；其余方向用 React Native
   * 给的约束。不用 Expo 的 AutoSizingComposable：它靠固有尺寸测量，设计库里用 BoxWithConstraints 的组件（空状态等）不支持。
   */
  @Composable
  private fun MeasuredSize(content: @Composable () -> Unit) {
    val horizontal = Direction.HORIZONTAL in autoSize
    val vertical = Direction.VERTICAL in autoSize
    Layout(content) { measurables, constraints ->
      val placeable = measurables.first().measure(
        Constraints(
          minWidth = 0,
          maxWidth = if (horizontal) Constraints.Infinity else constraints.maxWidth,
          minHeight = 0,
          maxHeight = if (vertical) Constraints.Infinity else constraints.maxHeight
        )
      )
      val width = if (horizontal) (placeable.width / density).toDouble() else Double.NaN
      val height = if (vertical) (placeable.height / density).toDouble() else Double.NaN
      if (!width.sameSize(reportedWidth) || !height.sameSize(reportedHeight)) {
        reportedWidth = width
        reportedHeight = height
        shadowNodeProxy.setViewSize(width, height)
      }
      layout(placeable.width, placeable.height) { placeable.place(0, 0) }
    }
  }
}

private fun Double.sameSize(other: Double) = (isNaN() && other.isNaN()) || this == other
