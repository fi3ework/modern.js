import path from 'path';
import { GeneratorContext, GeneratorCore } from '@modern-js/codesmith';
import { AppAPI } from '@modern-js/codesmith-api-app';
import { JsonAPI } from '@modern-js/codesmith-api-json';
import {
  ActionFunction,
  i18n as commonI18n,
  BaseGenerator,
  Solution,
  MWASchema,
  Language,
  BooleanConfig,
  ClientRoute,
  PackageManager,
  RunWay,
  EntryGenerator,
  ElectronGenerator,
  DependenceGenerator,
  MWAActionFunctionsDevDependencies,
} from '@modern-js/generator-common';
import {
  getMWAProjectPath,
  getAllPackages,
  i18n as utilsI18n,
  validatePackageName,
  validatePackagePath,
  getPackageVersion,
} from '@modern-js/generator-utils';
import { i18n, localeKeys } from '@/locale';

const getGeneratorPath = (generator: string, distTag: string) => {
  if (process.env.CODESMITH_ENV === 'development') {
    return path.dirname(require.resolve(generator));
  } else if (distTag) {
    return `${generator}@${distTag}`;
  }
  return generator;
};

// eslint-disable-next-line max-statements
const handleTemplateFile = async (
  context: GeneratorContext,
  generator: GeneratorCore,
  appApi: AppAPI,
) => {
  const jsonAPI = new JsonAPI(generator);

  const { isMonorepoSubProject, isTest, projectDir = '' } = context.config;

  const { outputPath } = generator;

  let packages: string[] = [];

  if (isMonorepoSubProject) {
    try {
      packages = getAllPackages(outputPath);
    } catch (e) {
      generator.logger.debug('get all packages error', e);
      generator.logger.warn(i18n.t(localeKeys.get_packages_error));
    }
  }

  const ans = await appApi.getInputBySchema(
    MWASchema,
    { ...context.config, isMwa: true, isEmptySrc: true },
    {
      packageName: input =>
        validatePackageName(input as string, packages, {
          isMonorepoSubProject,
        }),
      packagePath: input =>
        validatePackagePath(
          input as string,
          path.join(process.cwd(), projectDir),
          { isTest, isMwa: true },
        ),
    },
  );

  generator.logger.debug(`inputData=${JSON.stringify(ans)}`, ans);

  const {
    packageName,
    packagePath,
    language,
    runWay,
    packageManager,
    needModifyMWAConfig,
    disableStateManagement,
    clientRoute,
    enableLess,
    enableSass,
  } = ans;

  const projectPath = getMWAProjectPath(
    packagePath as string,
    isMonorepoSubProject,
    isTest,
  );

  const dirname = path.basename(generator.outputPath);

  await appApi.runSubGenerator(
    getGeneratorPath(BaseGenerator, context.config.distTag),
  );

  await appApi.forgeTemplate(
    'templates/base-template/**/*',
    undefined,
    resourceKey =>
      resourceKey
        .replace('templates/base-template/', projectPath)
        .replace('.handlebars', ''),
    {
      name: packageName || dirname,
      packageManager: packageManager as string,
      isMonorepoSubProject,
    },
  );

  if (language === Language.TS) {
    await jsonAPI.update(
      context.materials.default.get(path.join(projectPath, 'package.json')),
      {
        query: {},
        update: {
          $set: {
            'devDependencies.typescript': '^4',
            'devDependencies.@types/jest': '^26.0.9',
            'devDependencies.@types/react': '^17',
            'devDependencies.@types/react-dom': '^17',
            'devDependencies.@types/node': '^14',
          },
        },
      },
    );

    await appApi.forgeTemplate(
      'templates/ts-template/**/*',
      undefined,
      resourceKey =>
        resourceKey
          .replace('templates/ts-template/', projectPath)
          .replace('.handlebars', ''),
    );
  }

  if (packageManager === PackageManager.Pnpm) {
    await appApi.forgeTemplate(
      'templates/pnpm-template/**/*',
      undefined,
      resourceKey =>
        resourceKey
          .replace('templates/pnpm-template/', projectPath)
          .replace('.handlebars', ''),
    );
  }

  await appApi.runSubGenerator(
    getGeneratorPath(EntryGenerator, context.config.distTag),
    `./${projectPath}`,
    {
      ...context.config,
      disableStateManagement:
        needModifyMWAConfig === BooleanConfig.NO
          ? BooleanConfig.NO
          : disableStateManagement,
      clientRoute:
        needModifyMWAConfig === BooleanConfig.NO
          ? ClientRoute.SelfControlRoute
          : clientRoute,
      isSubGenerator: true,
    },
  );

  if (runWay === RunWay.Electron) {
    await appApi.runSubGenerator(
      getGeneratorPath(ElectronGenerator, context.config.distTag),
      undefined,
      {
        ...context.config,
        isSubGenerator: true,
      },
    );
  }

  if (enableLess) {
    const lessDependence =
      MWAActionFunctionsDevDependencies[ActionFunction.Less]!;
    await appApi.runSubGenerator(
      getGeneratorPath(DependenceGenerator, context.config.distTag),
      undefined,
      {
        dependencies: {
          [lessDependence]: await getPackageVersion(lessDependence),
        },
        isSubGenerator: true,
      },
    );
  }

  if (enableSass) {
    const sassDependence =
      MWAActionFunctionsDevDependencies[ActionFunction.Sass]!;
    await appApi.runSubGenerator(
      getGeneratorPath(DependenceGenerator, context.config.distTag),
      undefined,
      {
        dependencies: {
          [sassDependence]: await getPackageVersion(sassDependence),
        },
        isSubGenerator: true,
      },
    );
  }

  if (isMonorepoSubProject) {
    await appApi.updateWorkspace({
      name: packagePath as string,
      path: projectPath,
    });
  }

  return { projectPath };
};

// eslint-disable-next-line max-statements
export default async (context: GeneratorContext, generator: GeneratorCore) => {
  const appApi = new AppAPI(context, generator);

  const { locale } = context.config;
  commonI18n.changeLanguage({ locale });
  utilsI18n.changeLanguage({ locale });
  appApi.i18n.changeLanguage({ locale });
  i18n.changeLanguage({ locale });

  if (!(await appApi.checkEnvironment())) {
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  generator.logger.debug(`start run @modern-js/mwa-generator`);
  generator.logger.debug(`context=${JSON.stringify(context)}`);
  generator.logger.debug(`context.data=${JSON.stringify(context.data)}`);

  let projectPath = '';
  try {
    ({ projectPath } = await handleTemplateFile(context, generator, appApi));
  } catch (e) {
    generator.logger.error(e);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  if (context.handleForged) {
    await context.handleForged(
      Solution.MWA,
      context,
      context.config.hasPlugin,
      projectPath,
    );
  }

  try {
    await appApi.runGitAndInstall(context.config.gitCommitMessage);
  } catch (e) {
    generator.logger.error(e);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  appApi.showSuccessInfo(
    i18n.t(localeKeys.success, {
      packageManager: context.config.packageManager,
    }),
  );

  generator.logger.debug(`forge @modern-js/mwa-generator succeed `);
};
