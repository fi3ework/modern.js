import { createPlugin, usePlugins } from '@modern-js/core';
import { i18n } from './locale';
import {
  newCli,
  deployCli,
  buildCli,
  buildWatchCli,
  clearCli,
  installCli,
} from './cli';
import { getLocaleLanguage } from './utils/language';

// eslint-disable-next-line react-hooks/rules-of-hooks
usePlugins([require.resolve('@modern-js/plugin-changeset/cli')]);

export default createPlugin(
  () => {
    const locale = getLocaleLanguage();
    i18n.changeLanguage({ locale });

    return {
      commands({ program }: any) {
        buildCli(program);
        buildWatchCli(program);
        clearCli(program);
        deployCli(program);
        installCli(program);
        newCli(program, locale);
      },
    };
  },
  { post: ['@modern-js/plugin-changeset'] },
) as any;
