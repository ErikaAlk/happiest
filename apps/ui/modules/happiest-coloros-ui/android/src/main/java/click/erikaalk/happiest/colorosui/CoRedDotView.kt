package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoRedDot
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoRedDotProps(
  /** 不传画纯点，否则画数字胶囊。 */
  val count: MutableState<Int?> = mutableStateOf(null),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

class CoRedDotView(context: Context, appContext: AppContext) :
  CoHostedView<CoRedDotProps>(context, appContext) {
  override val props = CoRedDotProps()
  override val autoSize: EnumSet<Direction> = EnumSet.allOf(Direction::class.java)

  /** 没有读屏标签时不念（徽标在 React Native 实现里也不参与读屏），不用设计库默认的中文描述。 */
  @Composable
  override fun Hosted(modifier: Modifier) {
    CoRedDot(count = props.count.value, modifier = modifier, contentDescription = props.accessibilityText.value ?: "")
  }
}
