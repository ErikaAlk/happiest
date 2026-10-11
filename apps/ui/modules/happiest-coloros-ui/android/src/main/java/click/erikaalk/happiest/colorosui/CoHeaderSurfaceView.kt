package click.erikaalk.happiest.colorosui

import android.content.Context
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import click.erikaalk.coloroskit.bridge.SystemMaterial
import click.erikaalk.coloroskit.material.CoCapsuleShape
import click.erikaalk.coloroskit.material.CoMaterialSurface
import click.erikaalk.coloroskit.tokens.CoTokens
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.Direction
import expo.modules.kotlin.views.OptimizedComposeProps
import java.util.EnumSet

@OptimizedComposeProps
data class CoHeaderSurfaceProps(
  override val dark: MutableState<Boolean> = mutableStateOf(false),
  override val fontScale: MutableState<Float> = mutableStateOf(1f),
  override val reduceMotion: MutableState<Boolean> = mutableStateOf(false),
  override val accessibilityText: MutableState<String?> = mutableStateOf(null)
) : CoHostedProps

class CoHeaderSurfaceView(context: Context, appContext: AppContext) :
  CoHostedView<CoHeaderSurfaceProps>(context, appContext) {
  override val props = CoHeaderSurfaceProps()
  override val autoSize: EnumSet<Direction> = EnumSet.noneOf(Direction::class.java)

  @Composable
  override fun Hosted(modifier: Modifier) {
    CoMaterialSurface(
      material = { color, dark -> SystemMaterial.Presets.floatingBar(color, dark) },
      fallbackColor = CoTokens.Color.bar.current,
      shape = CoCapsuleShape,
      fallbackElevation = CoTokens.Shadow.FallbackLevel2.elevation,
      fallbackShadowColor = CoTokens.Shadow.FallbackLevel2.color,
      modifier = modifier.fillMaxSize()
    ) {}
  }
}
