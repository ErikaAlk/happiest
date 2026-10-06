package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import click.erikaalk.coloroskit.coThemeColor
import click.erikaalk.coloroskit.components.CoProgressBar
import click.erikaalk.coloroskit.tokens.CoTokens
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoProgressBarProps(
  val value: MutableState<Float> = mutableStateOf(0f),
  /** 条高 dp；不传用 COUI 的默认条高。 */
  val barHeight: MutableState<Float?> = mutableStateOf(null),
  /** 进度色；不传用主题色。 */
  val color: MutableState<android.graphics.Color?> = mutableStateOf(null),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 水平进度条：宽度跟随 React Native 布局，高度由组件决定。 */
class CoProgressBarView(context: Context, appContext: AppContext) :
  CoHostedView<CoProgressBarProps>(context, appContext) {
  override val props = CoProgressBarProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoProgressBar(
      value = props.value.value,
      modifier = modifier,
      height = props.barHeight.value?.dp ?: CoTokens.Progress.barHeight,
      color = props.color.value?.let { Color(it.toArgb()) } ?: coThemeColor.primary.current
    )
  }
}
