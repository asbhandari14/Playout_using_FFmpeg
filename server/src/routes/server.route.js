import { Router } from 'express';
import {
  getServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
  createServerSchema,
  updateServerSchema
} from '../controllers/server.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

// Super_admin and Admin can manage servers
router.get('/', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), getServers);
router.post('/', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), validate(createServerSchema), createServer);
router.get('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), getServerById);
router.put('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), validate(updateServerSchema), updateServer);
router.delete('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), deleteServer);

export default router;
