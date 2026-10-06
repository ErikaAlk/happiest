package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoCardPosition
import click.erikaalk.coloroskit.components.CoCategoryFooter
import click.erikaalk.coloroskit.components.CoCategoryTitle
import click.erikaalk.coloroskit.components.CoListItem
import click.erikaalk.coloroskit.components.CoTrailing
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

private fun cardPosition(value: String): CoCardPosition = when (value) {
  "head" -> CoCardPosition.Head
  "middle" -> CoCardPosition.Middle
  "tail" -> CoCardPosition.Tail
  "full" -> CoCardPosition.Full
  else -> error("未知的卡片位置 $value")
}

@OptimizedComposeProps
data class CoListItemProps(
  val title: MutableState<String> = mutableStateOf(""),
  val summary: MutableState<String?> = mutableStateOf(null),
  /** head / middle / tail / full：行在分组卡片里的位置。 */
  val position: MutableState<String> = mutableStateOf("full"),
  /** none / arrow / status / switch / custom。 */
  val trailing: MutableState<String> = mutableStateOf("none"),
  /** trailing 为 status 时右侧的当前值。 */
  val statusText: MutableState<String?> = mutableStateOf(null),
  /** trailing 为 status 或 custom 时是否再跟右箭头。 */
  val trailingArrow: MutableState<Boolean> = mutableStateOf(false),
  /** trailing 为 switch 时开关的状态。 */
  val switchChecked: MutableState<Boolean> = mutableStateOf(false),
  /** React Native 子视图依次是：前置图标（有则第 0 个）、行尾自定义内容（trailing 为 custom）。 */
  val hasLeading: MutableState<Boolean> = mutableStateOf(false),
  val enabled: MutableState<Boolean> = mutableStateOf(true),
  val selected: MutableState<Boolean> = mutableStateOf(false),
  val destructive: MutableState<Boolean> = mutableStateOf(false),
  val showDivider: MutableState<Boolean> = mutableStateOf(true),
  val pressable: MutableState<Boolean> = mutableStateOf(false),
  val longPressable: MutableState<Boolean> = mutableStateOf(false),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 卡片化列表的一行：宽度跟随 React Native 布局，高度由行内容决定。 */
class CoListItemView(context: Context, appContext: AppContext) :
  CoHostedView<CoListItemProps>(context, appContext) {
  override val props = CoListItemProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)
  private val onPress by EventDispatcher<Map<String, Any>>()
  private val onLongPress by EventDispatcher<Map<String, Any>>()
  private val onSwitchChange by EventDispatcher<Map<String, Boolean>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    val hasLeading = props.hasLeading.value
    val trailing = when (props.trailing.value) {
      "none" -> CoTrailing.None
      "arrow" -> CoTrailing.Arrow
      "status" -> CoTrailing.Status(requireNotNull(props.statusText.value) { "status 行尾缺少 statusText" }, arrow = props.trailingArrow.value)
      "switch" -> CoTrailing.Switch(props.switchChecked.value) { onSwitchChange(mapOf("checked" to it)) }
      "custom" -> CoTrailing.Custom(arrow = props.trailingArrow.value) { ReactChild(if (hasLeading) 1 else 0) }
      else -> error("未知的行尾 ${props.trailing.value}")
    }
    CoListItem(
      title = props.title.value,
      position = cardPosition(props.position.value),
      modifier = modifier,
      summary = props.summary.value,
      leading = if (hasLeading) { { ReactChild(0) } } else null,
      trailing = trailing,
      enabled = props.enabled.value,
      selected = props.selected.value,
      destructive = props.destructive.value,
      showDivider = props.showDivider.value,
      onLongClick = if (props.longPressable.value) { { onLongPress(emptyMap()) } } else null,
      onClick = if (props.pressable.value) { { onPress(emptyMap()) } } else null
    )
  }
}

@OptimizedComposeProps
data class CoCategoryTextProps(
  val text: MutableState<String> = mutableStateOf(""),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/** 分组标题。 */
class CoCategoryTitleView(context: Context, appContext: AppContext) :
  CoHostedView<CoCategoryTextProps>(context, appContext) {
  override val props = CoCategoryTextProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoCategoryTitle(props.text.value, modifier)
  }
}

/** 分组页脚说明（卡片外）。 */
class CoCategoryFooterView(context: Context, appContext: AppContext) :
  CoHostedView<CoCategoryTextProps>(context, appContext) {
  override val props = CoCategoryTextProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoCategoryFooter(props.text.value, modifier)
  }
}
