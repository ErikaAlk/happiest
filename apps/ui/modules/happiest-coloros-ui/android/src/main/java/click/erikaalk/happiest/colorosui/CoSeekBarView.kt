package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import click.erikaalk.coloroskit.components.CoSeekBar
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoSeekBarProps(
  /** 0..1。 */
  val value: MutableState<Float> = mutableStateOf(0f),
  /** 振动与读屏步进的份数。 */
  val steps: MutableState<Int> = mutableStateOf(100),
  val enabled: MutableState<Boolean> = mutableStateOf(true),
  /** 读屏念的数值（如“120%”）；不传时读屏按 0..1 的比例念百分数。 */
  val valueText: MutableState<String?> = mutableStateOf(null),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 滑块：宽度跟随 React Native 布局。拖动中连续回报 onValueChange，松手回报 onValueChangeFinished。 */
class CoSeekBarView(context: Context, appContext: AppContext) :
  CoHostedView<CoSeekBarProps>(context, appContext) {
  override val props = CoSeekBarProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)
  private val onValueChange by EventDispatcher<Map<String, Float>>()
  private val onValueChangeFinished by EventDispatcher<Map<String, Float>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    val valueText = props.valueText.value
    CoSeekBar(
      value = props.value.value,
      onValueChange = { onValueChange(mapOf("value" to it)) },
      // 与设计库挂在同一节点上的语义合并，读屏在范围信息之外改念这里给的数值
      modifier = if (valueText == null) modifier else modifier.semantics { stateDescription = valueText },
      enabled = props.enabled.value,
      steps = props.steps.value,
      onValueChangeFinished = { onValueChangeFinished(emptyMap()) }
    )
  }
}
