import path from 'path';
import { createPlugin, useAppContext } from '@modern-js/core';
import { createRuntimeExportsUtils, PLUGIN_SCHEMAS } from '@modern-js/utils';
import test from './test';

export default createPlugin(
  () => {
    let testingExportsUtils: ReturnType<typeof createRuntimeExportsUtils>;

    return {
      commands: ({ program }: any) => {
        program
          .command('test')
          .allowUnknownOption()
          .usage('[options]')
          .action(async () => {
            await test();
          });
      },
      validateSchema() {
        return PLUGIN_SCHEMAS['@modern-js/plugin-testing'];
      },
      config() {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { value: appContext } = useAppContext();

        testingExportsUtils = createRuntimeExportsUtils(
          appContext.internalDirectory,
          'testing',
        );

        return {
          source: {
            alias: {
              '@modern-js/runtime/testing': testingExportsUtils.getPath(),
            },
          },
        };
      },
      addRuntimeExports() {
        const testingPath = path.resolve(__dirname, '../');

        testingExportsUtils.addExport(`export * from '${testingPath}'`);
      },
    };
  },
  { name: '@modern-js/plugin-testing' },
) as any;
