import * as path from 'path';
import { fs, Import } from '@modern-js/utils';
import type { Platform } from '@/types';

const tsConfigutils: typeof import('../utils/tsconfig') = Import.lazy(
  '../utils/tsconfig',
  require,
);

const valid: typeof import('../utils/valide') = Import.lazy(
  '../utils/valide',
  require,
);
const buildFeature: typeof import('../features/build') = Import.lazy(
  '../features/build',
  require,
);
const core: typeof import('@modern-js/core') = Import.lazy(
  '@modern-js/core',
  require,
);
const dotenv: typeof import('dotenv') = Import.lazy('dotenv', require);

export interface IBuildOption {
  watch: boolean;
  tsconfig: string;
  platform: boolean | Exclude<Platform, 'all'>;
  styleOnly: boolean;
  tsc: boolean;
  clear: boolean;
}

export const build = async ({
  watch = false,
  tsconfig: tsconfigName,
  tsc,
  clear = true,
  platform,
}: IBuildOption) => {
  const {
    value: { appDirectory },
  } = core.useAppContext();
  const modernConfig = core.useResolvedConfigContext().value;
  const {
    output: { path: outputPath = 'dist' },
  } = modernConfig;
  const tsconfigPath = path.join(appDirectory, tsconfigName);
  dotenv.config();
  const isTsProject = tsConfigutils.existTsConfigFile(tsconfigPath);
  const enableTscCompiler = isTsProject && tsc;

  valid.valideBeforeTask({ modernConfig, tsconfigPath });

  if (clear) {
    fs.removeSync(path.join(appDirectory, outputPath));
  }

  // TODO: 一些配置只需要从modernConfig中获取
  await buildFeature.build(
    {
      enableWatchMode: watch,
      isTsProject,
      platform,
      sourceDir: 'src',
      tsconfigName,
      enableTscCompiler,
    },
    modernConfig,
  );

  process.on('SIGBREAK', () => {
    console.info('exit');
    const tempTsconfigFilePath = path.join(
      appDirectory,
      './tsconfig.temp.json',
    );
    if (fs.existsSync(tempTsconfigFilePath)) {
      fs.removeSync(tempTsconfigFilePath);
    }
  });
};
