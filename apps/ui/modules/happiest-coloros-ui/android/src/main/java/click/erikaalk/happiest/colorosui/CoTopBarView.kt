package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoBackIcon
import click.erikaalk.coloroskit.components.CoBarAction
import click.erikaalk.coloroskit.components.CoTopBar
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

class CoBarActionRecord : Record {
  @Field val contentDescription: String = ""

  /** 文字键；不传时是图标圆钮，图标取下一个 React Native 子视图。 */
  @Field val text: String? = null
  @Field val enabled: Boolean = true
}

@OptimizedComposeProps
data class CoTopBarProps(
  val title: MutableState<String> = mutableStateOf(""),
  /** 返回键的读屏名称；不传时没有返回键。 */
  val backDescription: MutableState<String?> = mutableStateOf(null),
  val actions: MutableState<List<CoBarActionRecord>> = mutableStateOf(emptyList()),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/**
 * 顶栏：宽度跟随 React Native 布局，高度含状态栏（设计库自己留出状态栏）。
 * React Native 子视图依次是没有 text 的各个按钮的图标，按设计库给的颜色上色。
 */
class CoTopBarView(context: Context, appContext: AppContext) :
  CoHostedView<CoTopBarProps>(context, appContext) {
  override val props = CoTopBarProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)
  private val onBack by EventDispatcher<Map<String, Any>>()
  private val onAction by EventDispatcher<Map<String, Int>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    var iconIndex = 0
    val actions = props.actions.value.mapIndexed { index, record ->
      val icon: (@Composable (tint: androidx.compose.ui.graphics.Color) -> Unit)? =
        if (record.text == null) {
          val child = iconIndex++
          { tint -> ReactChild(child, tint) }
        } else null
      CoBarAction(
        contentDescription = record.contentDescription,
        onClick = { onAction(mapOf("index" to index)) },
        text = record.text,
        icon = icon,
        enabled = record.enabled
      )
    }
    CoTopBar(
      title = props.title.value,
      modifier = modifier,
      navigation = props.backDescription.value?.let { description ->
        CoBarAction(description, onClick = { onBack(emptyMap()) }, icon = { tint -> CoBackIcon(tint) })
      },
      actions = actions
    )
  }
}
