import { createPlugin } from '@modern-js/core';
import { change, bump } from './commands';
import { i18n, localeKeys } from './locale';
import { getLocaleLanguage } from './utils';

export default createPlugin(
  () => {
    // initial cli language
    i18n.changeLanguage({ locale: getLocaleLanguage() });

    return {
      plugins() {
        return [{}];
      },
      commands({ program }: any) {
        program
          .command('change')
          .description(i18n.t(localeKeys.command.change.describe))
          .option('--empty', i18n.t(localeKeys.command.change.empty), false)
          .option('--open', i18n.t(localeKeys.command.change.open), false)
          .action((options: any) => change(options));

        program
          .command('bump')
          .description(i18n.t(localeKeys.command.bump.describe))
          .option('--canary', i18n.t(localeKeys.command.bump.canary), false)
          .option(
            '--preid <tag>',
            i18n.t(localeKeys.command.bump.preid),
            'next',
          )
          .option('--snapshot', i18n.t(localeKeys.command.bump.snapshot), false)
          .action((options: any) => bump(options));
      },
    };
  },
  { name: '@modern-js/plugin-changeset' },
) as any;
