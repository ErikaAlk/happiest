const fs = require('node:fs');
const path = require('node:path');
const {
  AndroidConfig,
  withAndroidStyles,
  withDangerousMod,
  withGradleProperties,
  withProjectBuildGradle,
  withSettingsGradle,
} = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const { parse: parseToml } = require('smol-toml');

// 设计库的 Compose 组件经 includeBuild 编译进安卓工程（apps/ui/modules/happiest-coloros-ui 依赖
// click.erikaalk.coloroskit:kit）。includeBuild 的子构建和主构建跑在同一个 Gradle 里，
// 所以 AGP、Kotlin 取设计库版本目录里的版本，设计库升级工具链时这里跟着变。
// SDK 级别写在设计库的 Kotlin DSL 里，读不出来；版本不够时 AAR 元数据校验与清单合并会直接报错。
const COLOROS_UI_KIT_COMPILE_SDK = 37;
const COLOROS_UI_KIT_MIN_SDK = 26;

// Gradle 版本夹在两头之间：设计库的 AGP 9.4 要求 Gradle 9.6.0 以上；React Native 0.88 与 Expo 的
// Gradle 插件是用 Kotlin 2.2 编译的 included build，只能读 Kotlin 2.3 及以下的元数据，而 Gradle 9.7
// 内嵌 Kotlin 2.4.0 标准库（9.7.1 实测编译失败）。9.6 内嵌 Kotlin 2.3.21，两边都满足。
const GRADLE_DISTRIBUTION_URL = 'https\\://services.gradle.org/distributions/gradle-9.6.1-bin.zip';

const INCLUDE_BUILD_TAG = 'coloros-ui-kit';
const AGP_CLASSPATH_PATTERN = /classpath\((['"])com\.android\.tools\.build:gradle(?::[^'"]*)?\1\)/;

function findColorOsUiKitAndroidDir(startDir) {
  const start = path.resolve(startDir);
  for (let dir = start; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'coloros-ui-kit', 'android');
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) {
      return candidate;
    }
    if (path.dirname(dir) === dir) {
      throw new Error(
        `找不到设计库 coloros-ui-kit：从 ${start} 逐级向上都没有 coloros-ui-kit/android。` +
          '设计库要和 Happiest 并排放在同一个目录下（Windows 为 Workspace/code，WSL 为 /home/erika）。'
      );
    }
  }
}

function readPropertyValue(props, key, filePath) {
  const item = props.find((p) => p.type === 'property' && p.key === key);
  if (!item) {
    throw new Error(`${filePath} 缺少 ${key}`);
  }
  return item.value;
}

function readColorOsUiKitToolchain(kitAndroidDir) {
  const catalogPath = path.join(kitAndroidDir, 'gradle', 'libs.versions.toml');
  const catalog = parseToml(fs.readFileSync(catalogPath, 'utf8'));
  const versions = catalog.versions ?? {};
  if (typeof versions.agp !== 'string' || typeof versions.kotlin !== 'string') {
    throw new Error(`${catalogPath} 的 [versions] 缺少 agp 或 kotlin`);
  }
  return {
    androidGradlePluginVersion: versions.agp,
    kotlinVersion: versions.kotlin,
  };
}

function toGroovySingleQuoted(value) {
  return `'${value.replace(/\\/g, '/').replace(/'/g, "\\'")}'`;
}

function applyColorOsUiKitIncludeBuild(settingsGradle, kitAndroidDir) {
  return mergeContents({
    src: settingsGradle,
    newSrc: `includeBuild(${toGroovySingleQuoted(kitAndroidDir)})`,
    tag: INCLUDE_BUILD_TAG,
    anchor: /^includeBuild\(expoAutolinking\.reactNativeGradlePlugin\)/m,
    offset: 1,
    comment: '//',
  }).contents;
}

function applyAndroidGradlePluginVersion(buildGradle, version) {
  if (!AGP_CLASSPATH_PATTERN.test(buildGradle)) {
    throw new Error('根 build.gradle 里找不到 com.android.tools.build:gradle 的 classpath，无法固定 AGP 版本');
  }
  return buildGradle.replace(AGP_CLASSPATH_PATTERN, `classpath('com.android.tools.build:gradle:${version}')`);
}

function upsertProperty(props, key, value) {
  const existing = props.find((p) => p.type === 'property' && p.key === key);
  if (existing) {
    existing.value = value;
    return;
  }
  props.push({ type: 'property', key, value });
}

function applyColorOsUiKitGradleProperties(props, { kotlinVersion }) {
  upsertProperty(props, 'android.kotlinVersion', kotlinVersion);
  upsertProperty(props, 'android.compileSdkVersion', String(COLOROS_UI_KIT_COMPILE_SDK));
  upsertProperty(props, 'android.minSdkVersion', String(COLOROS_UI_KIT_MIN_SDK));
  return props;
}

function applyGradleWrapperDistribution(wrapperProperties, distributionUrl) {
  const props = AndroidConfig.Properties.parsePropertiesFile(wrapperProperties);
  readPropertyValue(props, 'distributionUrl', 'gradle-wrapper.properties');
  upsertProperty(props, 'distributionUrl', distributionUrl);
  return AndroidConfig.Properties.propertiesListToString(props);
}

const withColorOsUiKit = (config) => {
  // 只在生成安卓工程时查找设计库：网页、桌面与 iOS 也会求值这份配置，那里不需要设计库
  let kit = null;
  const resolveKit = (projectRoot) => {
    if (kit === null) {
      const kitAndroidDir = findColorOsUiKitAndroidDir(projectRoot);
      kit = { kitAndroidDir, toolchain: readColorOsUiKitToolchain(kitAndroidDir) };
    }
    return kit;
  };

  config = withSettingsGradle(config, (settingsConfig) => {
    const { kitAndroidDir } = resolveKit(settingsConfig.modRequest.projectRoot);
    settingsConfig.modResults.contents = applyColorOsUiKitIncludeBuild(settingsConfig.modResults.contents, kitAndroidDir);
    return settingsConfig;
  });

  config = withProjectBuildGradle(config, (buildConfig) => {
    const { toolchain } = resolveKit(buildConfig.modRequest.projectRoot);
    buildConfig.modResults.contents = applyAndroidGradlePluginVersion(
      buildConfig.modResults.contents,
      toolchain.androidGradlePluginVersion
    );
    return buildConfig;
  });

  config = withGradleProperties(config, (propsConfig) => {
    const { toolchain } = resolveKit(propsConfig.modRequest.projectRoot);
    applyColorOsUiKitGradleProperties(propsConfig.modResults, toolchain);
    return propsConfig;
  });

  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const wrapperPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );
      const current = await fs.promises.readFile(wrapperPath, 'utf8');
      await fs.promises.writeFile(wrapperPath, applyGradleWrapperDistribution(current, GRADLE_DISTRIBUTION_URL));
      return modConfig;
    },
  ]);

  // 深色由设计库的 CoTheme 自己画，宿主主题禁止系统强制深色（设计库 README）
  config = withAndroidStyles(config, (stylesConfig) => {
    stylesConfig.modResults = AndroidConfig.Styles.assignStylesValue(stylesConfig.modResults, {
      add: true,
      name: 'android:forceDarkAllowed',
      value: 'false',
      parent: AndroidConfig.Styles.getAppThemeGroup(),
    });
    return stylesConfig;
  });

  return config;
};

withColorOsUiKit.findColorOsUiKitAndroidDir = findColorOsUiKitAndroidDir;
withColorOsUiKit.readColorOsUiKitToolchain = readColorOsUiKitToolchain;
withColorOsUiKit.applyColorOsUiKitIncludeBuild = applyColorOsUiKitIncludeBuild;
withColorOsUiKit.applyAndroidGradlePluginVersion = applyAndroidGradlePluginVersion;
withColorOsUiKit.applyColorOsUiKitGradleProperties = applyColorOsUiKitGradleProperties;
withColorOsUiKit.applyGradleWrapperDistribution = applyGradleWrapperDistribution;

module.exports = withColorOsUiKit;
