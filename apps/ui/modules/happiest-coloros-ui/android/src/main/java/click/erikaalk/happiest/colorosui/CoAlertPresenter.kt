package click.erikaalk.happiest.colorosui

import android.app.Activity
import android.view.ViewGroup
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import click.erikaalk.coloroskit.CoTheme
import click.erikaalk.coloroskit.components.CoAlertDialog
import click.erikaalk.coloroskit.components.CoDialogButton
import click.erikaalk.coloroskit.components.CoDialogButtonRole
import click.erikaalk.coloroskit.components.CoDialogPlacement
import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class CoAlertButtonRecord : Record {
  @Field val text: String = ""

  /** normal / recommended / danger。 */
  @Field val role: String = "normal"
}

class CoAlertOptions : Record {
  @Field val title: String? = null
  @Field val message: String? = null
  @Field val buttons: List<CoAlertButtonRecord> = emptyList()

  /** false 时点遮罩、返回键都不关闭，只能点按钮（Alert 的 cancelable: false）。 */
  @Field val dismissible: Boolean = true
  @Field val dark: Boolean = false
  @Field val fontScale: Float = 1f
  @Field val reduceMotion: Boolean = false
}

/**
 * 命令式提示框：在当前 Activity 的内容层加一个 ComposeView 承载 [CoAlertDialog]，按钮下标或 -1（点遮罩、返回键）
 * 回给 JavaScript 后移除。设计库的对话框点按钮时先回调按钮、再回调关闭，这里只取第一次。
 */
internal object CoAlertPresenter {
  fun show(activity: Activity, options: CoAlertOptions, promise: Promise) {
    require(options.buttons.isNotEmpty()) { "提示框至少要有一个按钮" }
    val container = activity.findViewById<ViewGroup>(android.R.id.content)
    val host = ComposeView(activity)
    var settled = false
    fun settle(index: Int) {
      if (settled) return
      settled = true
      promise.resolve(index)
      host.post { container.removeView(host) }
    }
    host.setParentCompositionContext(CoCompositionContexts.of(activity))
    host.setContent {
      SideEffect { CoMotionDurationScale.reduceMotion = options.reduceMotion }
      val base = LocalDensity.current
      CompositionLocalProvider(LocalDensity provides Density(base.density, base.fontScale * options.fontScale)) {
        CoTheme(dark = options.dark) {
          CoAlertDialog(
            onDismissRequest = { settle(-1) },
            title = options.title,
            message = options.message,
            buttons = options.buttons.mapIndexed { index, button ->
              CoDialogButton(button.text, role(button.role)) { settle(index) }
            },
            placement = CoDialogPlacement.Bottom,
            paneTitle = options.title ?: options.message ?: options.buttons.first().text,
            dismissible = options.dismissible
          )
        }
      }
    }
    container.addView(host)
  }

  private fun role(value: String): CoDialogButtonRole = when (value) {
    "normal" -> CoDialogButtonRole.Normal
    "recommended" -> CoDialogButtonRole.Recommended
    "danger" -> CoDialogButtonRole.Danger
    else -> error("未知的按钮角色 $value")
  }
}
