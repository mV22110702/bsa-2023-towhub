import { config } from '~/libs/packages/config/config.js';
import { database } from '~/libs/packages/database/database.js';
import { logger } from '~/libs/packages/logger/logger.js';
import { authController } from '~/packages/auth/auth.js';
import { businessController } from '~/packages/business/business.js';
import { filesController } from '~/packages/files/files.js';
import { userController } from '~/packages/users/users.js';

import { ServerApp } from './server-app.js';
import { ServerAppApi } from './server-app-api.js';

const apiV1 = new ServerAppApi(
  'v1',
  config,
  ...authController.routes,
  ...userController.routes,
  ...businessController.routes,
  ...filesController.routes,
);

const serverApp = new ServerApp({
  config,
  logger,
  database,
  apis: [apiV1],
});

export { type ServerAppRouteParameters } from './libs/types/types.js';
export { serverApp };
