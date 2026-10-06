package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoEmptyState
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoEmptyStateProps(
  val title: MutableState<String> = mutableStateOf(""),
  val subtitle: MutableState<String?> = mutableStateOf(null),
  val actionText: MutableState<String?> = mutableStateOf(null),
  /** 第 0 个 React Native 子视图是插画 / 图标。 */
  val hasImage: MutableState<Boolean> = mutableStateOf(false),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 空状态：宽度跟随 React Native 布局，放在滚动内容里时上下各留 48dp（设计库规则）。 */
class CoEmptyStateView(context: Context, appContext: AppContext) :
  CoHostedView<CoEmptyStateProps>(context, appContext) {
  override val props = CoEmptyStateProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)
  private val onAction by EventDispatcher<Map<String, Any>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    val actionText = props.actionText.value
    CoEmptyState(
      title = props.title.value,
      modifier = modifier,
      subtitle = props.subtitle.value,
      actionText = actionText,
      onAction = if (actionText != null) { { onAction(emptyMap()) } } else null,
      image = if (props.hasImage.value) { { ReactChild(0) } } else null
    )
  }
}
