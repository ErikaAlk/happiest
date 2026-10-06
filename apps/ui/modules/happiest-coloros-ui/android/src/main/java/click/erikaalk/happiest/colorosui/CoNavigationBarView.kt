package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.components.CoAccessory
import click.erikaalk.coloroskit.components.CoFloatingNavigationBar
import click.erikaalk.coloroskit.components.CoNavBadge
import click.erikaalk.coloroskit.components.CoNavBarSize
import click.erikaalk.coloroskit.components.CoNavItem
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

class CoNavItemRecord : Record {
  @Field val label: String = ""
  @Field val enabled: Boolean = true

  /** 数字徽标；与 [badgeDot] 都不传时没有徽标。 */
  @Field val badgeCount: Int? = null
  @Field val badgeDot: Boolean = false
}

@OptimizedComposeProps
data class CoNavigationBarProps(
  val items: MutableState<List<CoNavItemRecord>> = mutableStateOf(emptyList()),
  val selectedIndex: MutableState<Int> = mutableStateOf(0),
  val showLabels: MutableState<Boolean> = mutableStateOf(true),
  /** compact / regular / large。 */
  val size: MutableState<String> = mutableStateOf("regular"),
  /** 右侧附属圆钮的读屏名称；不传时没有附属圆钮。 */
  val endAccessoryDescription: MutableState<String?> = mutableStateOf(null),
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

/**
 * 悬浮底栏：宽度跟随 React Native 布局，高度由档位与是否显示文字决定。
 * React Native 子视图依次是每一项的两个图标（先线框、后实心；设计库在两者之间淡入淡出），最后是附属圆钮的图标；图标按设计库给的颜色上色。
 * 徽标在 React Native 实现里不参与读屏，这里同样不念。
 */
class CoNavigationBarView(context: Context, appContext: AppContext) :
  CoHostedView<CoNavigationBarProps>(context, appContext) {
  override val props = CoNavigationBarProps()
  override val autoSize: EnumSet<Direction> = EnumSet.of(Direction.VERTICAL)
  // 不叫 onSelect：topSelect 在 React Native 里是冒泡事件，同名的直达事件会让视图配置报错
  private val onItemSelect by EventDispatcher<Map<String, Int>>()
  private val onEndAccessory by EventDispatcher<Map<String, Any>>()

  @Composable
  override fun Hosted(modifier: Modifier) {
    val records = props.items.value
    val items = records.mapIndexed { index, record ->
      CoNavItem(
        label = record.label,
        enabled = record.enabled,
        badge = when {
          record.badgeCount != null -> CoNavBadge.Count(record.badgeCount, contentDescription = "")
          record.badgeDot -> CoNavBadge.Dot(contentDescription = "")
          else -> null
        }
      ) { selected, tint -> ReactChild(index * 2 + if (selected) 1 else 0, tint) }
    }
    val accessoryDescription = props.endAccessoryDescription.value
    CoFloatingNavigationBar(
      items = items,
      selectedIndex = props.selectedIndex.value,
      onSelect = { onItemSelect(mapOf("index" to it)) },
      modifier = modifier,
      endAccessory = accessoryDescription?.let { description ->
        CoAccessory(description, onClick = { onEndAccessory(emptyMap()) }) { tint -> ReactChild(records.size * 2, tint) }
      },
      // 点当前项也派发：JavaScript 用它回到该页签的根页面
      dispatchWhenAlreadySelected = true,
      showLabels = props.showLabels.value,
      size = when (props.size.value) {
        "compact" -> CoNavBarSize.Compact
        "regular" -> CoNavBarSize.Regular
        "large" -> CoNavBarSize.Large
        else -> error("未知的底栏档位 ${props.size.value}")
      }
    )
  }
}
