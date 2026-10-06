package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoLoading
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoLoadingProps(
  val large: MutableState<Boolean> = mutableStateOf(false),
  /** false 时停转但保持可见（离屏行、状态不再上报时）。 */
  val animating: MutableState<Boolean> = mutableStateOf(true),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

class CoLoadingView(context: Context, appContext: AppContext) :
  CoHostedView<CoLoadingProps>(context, appContext) {
  override val props = CoLoadingProps()
  override val autoSize: EnumSet<Direction> = EnumSet.allOf(Direction::class.java)

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoLoading(modifier = modifier, large = props.large.value, animating = props.animating.value)
  }
}
