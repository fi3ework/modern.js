import { createServer, Server } from 'http';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { createSecureServer } from 'http2';
import Koa from 'koa';
import koaStatic from 'koa-static';
import koaCors from '@koa/cors';
import c2k from 'koa-connect';
import type { Plugin as RollupPlugin } from 'rollup';
import { FSWatcher } from 'chokidar';
import {
  findMonorepoRoot,
  chalk,
  HMR_SOCK_PATH,
  isTypescript,
  prettyInstructions,
  clearConsole,
} from '@modern-js/utils';
import { IAppContext, NormalizedConfig } from '@modern-js/core';
import { macrosPlugin } from './plugins/macro';
import { lanuchEditorMiddleware } from './middlewares/lanuch-editor';
import { assetsPlugin } from './plugins/assets';
import { transformMiddleware } from './middlewares/transform';
import { WebSocketServer, onFileChange } from './websocket-server';
import { HOST } from './constants';
import { optimizeDeps } from './install/local-optimize';
import {
  getBFFMiddleware,
  shouldEnableBabelMacros,
  shouldUseBff,
} from './utils';
import { historyApiFallbackMiddleware } from './middlewares/history-api-fallback';
import { notFoundMiddleware } from './middlewares/not-found';
import { aliasPlugin, tsAliasPlugin } from './plugins/alias';
import { esbuldPlugin } from './plugins/esbuild';
import { hmrPlugin } from './plugins/hmr';
import { jsonPlugin } from './plugins/json';
import { resolvePlugin } from './plugins/resolve';
import { definePlugin } from './plugins/define';
import { cssPlugin } from './plugins/css';
import { createPluginContainer, PluginContainer } from './plugins/container';
import { importRewritePlugin } from './plugins/import-rewrite';
import { proxyMiddleware } from './middlewares/proxy';
import { fastRefreshPlugin } from './plugins/fast-refresh';
import { errorOverlayMiddleware } from './middlewares/error-overlay';
import { lazyImportPlugin } from './plugins/lazy-import';
import { startTimer } from './dev';
import { fsWatcher } from './watcher';
import { lambdaApiPlugin } from './plugins/lambda-api';

export interface ESMServer {
  https: boolean;
  appDirectory: string;
  config: NormalizedConfig;
  httpServer: Server;
  wsServer: WebSocketServer;
  watcher: FSWatcher;
  pluginContainer: PluginContainer;
}

export const createDevServer = async (
  config: NormalizedConfig,
  appContext: IAppContext,
): Promise<ESMServer> => {
  const { appDirectory } = appContext;
  const { https } = (config.server as any) || {};
  const { disableAutoImportStyle } = (config.output as any) || {};

  const app = new Koa();

  const httpServer = https
    ? await createHttpsServer(app)
    : createServer(app.callback());

  const wsServer = new WebSocketServer(httpServer, HMR_SOCK_PATH);

  const watcher = fsWatcher.init(appDirectory);

  const pluginContainer = await createPluginContainer(
    [
      aliasPlugin(config, appContext),
      isTypescript(appDirectory) && tsAliasPlugin(config, appContext),
      assetsPlugin(config, appContext),
      shouldUseBff(appDirectory) && lambdaApiPlugin(config, appContext),
      esbuldPlugin(config, appContext),
      shouldEnableBabelMacros(appDirectory) && macrosPlugin(config),
      !disableAutoImportStyle && lazyImportPlugin(),
      resolvePlugin(config, appContext),
      definePlugin(config),
      jsonPlugin(config),
      cssPlugin(config, appContext),
      importRewritePlugin(config, appContext, wsServer),
      fastRefreshPlugin(),
      hmrPlugin(config, appContext),
    ].filter(Boolean) as RollupPlugin[],
    config,
    appContext,
  );

  const server: ESMServer = {
    https,
    appDirectory,
    config,
    httpServer,
    wsServer,
    watcher,
    pluginContainer,
  };

  watcher.on('change', filename => onFileChange(server, filename));

  // keep it at the beginning of the middleware chain to catch interal error
  app.use(errorOverlayMiddleware(server));

  app.use(lanuchEditorMiddleware());

  proxyMiddleware(config, appContext).map(middleware =>
    app.use(c2k(middleware)),
  );

  app.use(koaCors({ origin: '*' }));

  app.use(transformMiddleware(config, appContext, pluginContainer));

  // history api fallback to specific html
  app.use(historyApiFallbackMiddleware(config, appContext));

  const monorepoRootDir = findMonorepoRoot(appDirectory);

  app.use(
    koaStatic(monorepoRootDir ? '/' : appDirectory, {
      index: false,
      hidden: true,
    }),
  );

  if (shouldUseBff(appDirectory)) {
    app.use(c2k(getBFFMiddleware(config, appContext) as any));
  }

  // hanlde 404
  app.use(notFoundMiddleware());

  return server;
};

export const startDevServer = async (
  userConfig: NormalizedConfig,
  appContext: IAppContext,
) => {
  const { port } = userConfig.server;

  // TODO: bff
  // await setupBFFAPI(userConfig, api, port);

  const { httpServer, pluginContainer } = await createDevServer(
    userConfig,
    appContext,
  );

  await pluginContainer.buildStart({});

  await optimizeDeps(userConfig, appContext);

  httpServer.listen(port, HOST, () => {
    startTimer.end = Date.now();

    clearConsole();
    // eslint-disable-next-line no-console
    console.log(
      chalk.greenBright(
        `Unbundle mode ready in ${startTimer.end - startTimer.start}ms\n`,
      ),
    );

    let message = chalk.cyanBright(`  🛫 App running at: \n`);

    message += prettyInstructions(appContext);

    message += `\n${chalk.cyanBright(
      [
        `Note that unbundle mode require native ESM dynamic import support.`,
        `To dev for legacy browsers, use yarn dev.`,
      ].join('\n'),
    )}`;

    // eslint-disable-next-line no-console
    console.log(message);
  });
};

const createHttpsServer = async (app: Koa): Promise<Server> => {
  const { key, cert } = await require('devcert').certificateFor('localhost');

  return createSecureServer(
    {
      key,
      cert,
      allowHTTP1: true,
    },
    app.callback(),
  ) as any;
};
