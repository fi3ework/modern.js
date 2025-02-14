import path from 'path';
import { GeneratorContext, GeneratorCore } from '@modern-js/codesmith';
import { fs, getPackageVersion, isTsProject } from '@modern-js/generator-utils';
import { AppAPI } from '@modern-js/codesmith-api-app';
import { JsonAPI } from '@modern-js/codesmith-api-json';
import {
  Framework,
  i18n,
  Language,
  ServerSchema,
} from '@modern-js/generator-common';

function isEmptyServerDir(serverDir: string) {
  const files = fs.readdirSync(serverDir);
  if (files.length === 0) {
    return true;
  }
  return files.every(file => {
    const childFiles = fs.readdirSync(path.join(serverDir, file));
    return childFiles.length === 0;
  });
}

const handleTemplateFile = async (
  context: GeneratorContext,
  generator: GeneratorCore,
  appApi: AppAPI,
) => {
  const jsonAPI = new JsonAPI(generator);
  const ans = await appApi.getInputBySchema(ServerSchema, context.config);

  const appDir = context.materials.default.basePath;
  const serverDir = path.join(appDir, 'server');

  if (fs.existsSync(serverDir) && !isEmptyServerDir(serverDir)) {
    const files = fs.readdirSync('server');
    if (files.length > 0) {
      generator.logger.warn("'server' is already exist");
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }

  const { framework } = ans;

  const language = isTsProject(appDir) ? Language.TS : Language.JS;

  if (language === Language.JS && framework === Framework.Nest) {
    generator.logger.warn('nest not support js project');
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  await jsonAPI.update(
    context.materials.default.get(path.join(appDir, 'package.json')),
    {
      query: {},
      update: {
        $set: {
          'dependencies.@modern-js/plugin-server-build': `^${await getPackageVersion(
            '@modern-js/plugin-server-build',
          )}`,
          [`dependencies.@modern-js/plugin-${
            framework as string
          }`]: `^${await getPackageVersion(
            `@modern-js/plugin-${framework as string}`,
          )}`,
          [`dependencies.${framework as string}`]: `^${await getPackageVersion(
            framework as string,
          )}`,
        },
      },
    },
  );

  await appApi.forgeTemplate(
    `templates/${framework as string}/**/*`,
    resourceKey =>
      framework === Framework.Egg ? resourceKey.includes(language) : true,
    resourceKey =>
      resourceKey
        .replace(`templates/${framework as string}/`, 'server/')
        .replace(
          '.handlebars',
          framework === Framework.Egg || framework === Framework.Nest
            ? ''
            : `.${language}`,
        ),
  );
};

export default async (context: GeneratorContext, generator: GeneratorCore) => {
  const appApi = new AppAPI(context, generator);

  const { locale } = context.config;
  i18n.changeLanguage({ locale });
  appApi.i18n.changeLanguage({ locale });

  if (!(await appApi.checkEnvironment())) {
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  generator.logger.debug(`start run @modern-js/server-generator`);
  generator.logger.debug(`context=${JSON.stringify(context)}`);
  generator.logger.debug(`context.data=${JSON.stringify(context.data)}`);

  await handleTemplateFile(context, generator, appApi);

  await appApi.runInstall();

  appApi.showSuccessInfo();

  generator.logger.debug(`forge @modern-js/server-generator succeed `);
};
