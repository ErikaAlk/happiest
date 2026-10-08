package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoFloatingButton
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoFloatingButtonProps(
  val enabled: MutableState<Boolean> = mutableStateOf(true),
  /** 第 0 个 React Native 子视图是图标，按设计库给的颜色上色。 */
  val hasIcon: MutableState<Boolean> = mutableStateOf(false),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 悬浮按钮：由调用方用 React Native 摆在页面右下角。读屏名称就是 accessibilityText。 */
class CoFloatingButtonView(context: Context, appContext: AppContext) :
  CoHostedView<CoFloatingButtonProps>(context, appContext) {
  override val props = CoFloatingButtonProps()
  override val autoSize: EnumSet<Direction> = EnumSet.allOf(Direction::class.java)
  private val onPress by EventDispatcher<Map<String, Any>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    val description = requireNotNull(props.accessibilityText.value) { "悬浮按钮必须有读屏名称" }
    if (props.hasIcon.value) {
      CoFloatingButton(
        onClick = { onPress(emptyMap()) },
        enabled = props.enabled.value,
        contentDescription = description,
        icon = { tint -> ReactChild(0, tint) }
      )
    } else {
      CoFloatingButton(onClick = { onPress(emptyMap()) }, enabled = props.enabled.value, contentDescription = description)
    }
  }
}
