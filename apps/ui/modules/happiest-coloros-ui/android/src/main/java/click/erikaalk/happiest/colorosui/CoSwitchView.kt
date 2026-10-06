package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoSwitch
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoSwitchProps(
  val checked: MutableState<Boolean> = mutableStateOf(false),
  val enabled: MutableState<Boolean> = mutableStateOf(true),
  val interactive: MutableState<Boolean> = mutableStateOf(true),
  /** 读屏念的开 / 关状态，经 t(...) 按应用语言传入。 */
  val onStateDescription: MutableState<String> = mutableStateOf(""),
  val offStateDescription: MutableState<String> = mutableStateOf(""),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

class CoSwitchView(context: Context, appContext: AppContext) :
  CoHostedView<CoSwitchProps>(context, appContext) {
  override val props = CoSwitchProps()
  override val autoSize: EnumSet<Direction> = EnumSet.allOf(Direction::class.java)
  private val onCheckedChange by EventDispatcher<Map<String, Boolean>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoSwitch(
      checked = props.checked.value,
      onCheckedChange = if (props.interactive.value) { value -> onCheckedChange(mapOf("checked" to value)) } else null,
      modifier = modifier,
      enabled = props.enabled.value,
      onStateDescription = props.onStateDescription.value,
      offStateDescription = props.offStateDescription.value
    )
  }
}
