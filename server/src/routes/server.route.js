import { Router } from 'express';
import {
  getAllServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
} from '../controllers/server.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { role } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Super_admin and Admin can manage servers
router.get('/all', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), getAllServers);
router.get('/:id', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getServerById);
router.post('/create', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), createServer);
router.put('/update/:id', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), updateServer);
router.delete('/delete/:id', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), deleteServer);

export default router;
