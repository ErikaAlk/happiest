package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoCheckBox
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoCheckBoxProps(
  val checked: MutableState<Boolean> = mutableStateOf(false),
  val enabled: MutableState<Boolean> = mutableStateOf(true),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 只显示的复选框：点按由外层 React Native 的可点区域接（多选列表整行或整块接勾选）。 */
class CoCheckBoxView(context: Context, appContext: AppContext) :
  CoHostedView<CoCheckBoxProps>(context, appContext) {
  override val props = CoCheckBoxProps()
  override val autoSize: EnumSet<Direction> = EnumSet.allOf(Direction::class.java)

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoCheckBox(checked = props.checked.value, onCheckedChange = null, modifier = modifier, enabled = props.enabled.value)
  }
}
