import NodeEnvironment from 'jest-environment-node';
import { createApp } from './app';
import { bff_info_key } from './constant';

// eslint-disable-next-line import/no-anonymous-default-export
export default class extends NodeEnvironment {
  app: any;

  async setup() {
    const bff_info = (global as any)[bff_info_key];
    // eslint-disable-next-line no-multi-assign
    this.global.app = this.app = await createApp(
      bff_info.appDir,
      bff_info.modernUserConfig,
      bff_info.plugins,
      bff_info.routes,
    );
  }

  async teardown() {
    await this.app?.server?.close();
  }
}
