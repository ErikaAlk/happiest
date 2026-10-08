package click.erikaalk.happiest.colorosui

import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HappiestColorOsUiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HappiestColorOsUi")

    AsyncFunction("showAlert") { options: CoAlertOptions, promise: Promise ->
      val activity = requireNotNull(appContext.currentActivity) { "显示提示框时没有当前 Activity" }
      CoAlertPresenter.show(activity, options, promise)
    }.runOnQueue(Queues.MAIN)

    View(CoSwitchView::class) {
      Events("onCheckedChange")
    }
    View(CoCheckBoxView::class)
    View(CoSeekBarView::class) {
      Events("onValueChange", "onValueChangeFinished")
    }
    View(CoProgressBarView::class)
    View(CoLoadingView::class)
    View(CoRedDotView::class)
    View(CoEmptyStateView::class) {
      Events("onAction")
    }
    View(CoFloatingButtonView::class) {
      Events("onPress")
    }
    View(CoListItemView::class) {
      Events("onPress", "onLongPress", "onSwitchChange")
    }
    View(CoCategoryTitleView::class)
    View(CoCategoryFooterView::class)
    View(CoButtonView::class) {
      Events("onPress")
    }
    View(CoNavigationBarView::class) {
      Events("onItemSelect", "onEndAccessory")
    }
    View(CoTopBarView::class) {
      Events("onBack", "onAction")
    }
  }
}
