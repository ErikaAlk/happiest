package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import click.erikaalk.coloroskit.components.CoButton
import click.erikaalk.coloroskit.components.CoButtonSize
import click.erikaalk.coloroskit.components.CoButtonType
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoButtonProps(
  val text: MutableState<String> = mutableStateOf(""),
  /** primary / secondary / transparent / outline / text。 */
  val buttonType: MutableState<String> = mutableStateOf("primary"),
  /** large / small。 */
  val size: MutableState<String> = mutableStateOf("large"),
  val enabled: MutableState<Boolean> = mutableStateOf(true),
  val loading: MutableState<Boolean> = mutableStateOf(false),
  val loadingDescription: MutableState<String> = mutableStateOf(""),
  /** 文字色；不传按类型取设计库的颜色。 */
  val textColor: MutableState<android.graphics.Color?> = mutableStateOf(null),
  /** 宽度跟随 React Native 布局撑满；否则按内容。 */
  val fillWidth: MutableState<Boolean> = mutableStateOf(false),
  /** React Native 子视图依次是：前置图标（有则第 0 个）、后置图标。 */
  val hasLeading: MutableState<Boolean> = mutableStateOf(false),
  val hasTrailing: MutableState<Boolean> = mutableStateOf(false),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

class CoButtonView(context: Context, appContext: AppContext) :
  CoHostedView<CoButtonProps>(context, appContext) {
  override val props = CoButtonProps()
  override val autoSize: EnumSet<Direction>
    get() = if (props.fillWidth.value) EnumSet.of(Direction.VERTICAL) else EnumSet.allOf(Direction::class.java)
  private val onPress by EventDispatcher<Map<String, Any>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    val hasLeading = props.hasLeading.value
    CoButton(
      text = props.text.value,
      onClick = { onPress(emptyMap()) },
      // 内容宽度先按固有尺寸确定，让设计库的加权文字获得有限的测量约束。
      modifier = if (props.fillWidth.value) modifier.fillMaxWidth() else modifier.width(IntrinsicSize.Max),
      type = when (props.buttonType.value) {
        "primary" -> CoButtonType.Primary
        "secondary" -> CoButtonType.Secondary
        "transparent" -> CoButtonType.Transparent
        "outline" -> CoButtonType.Outline
        "text" -> CoButtonType.Text
        else -> error("未知的按钮类型 ${props.buttonType.value}")
      },
      size = when (props.size.value) {
        "large" -> CoButtonSize.Large
        "small" -> CoButtonSize.Small
        else -> error("未知的按钮尺寸 ${props.size.value}")
      },
      enabled = props.enabled.value,
      textColor = props.textColor.value?.let { Color(it.toArgb()) },
      loading = props.loading.value,
      loadingDescription = props.loadingDescription.value,
      leading = if (hasLeading) { { ReactChild(0) } } else null,
      trailing = if (props.hasTrailing.value) { { ReactChild(if (hasLeading) 1 else 0) } } else null
    )
  }
}
