import { Router } from 'express';
import { createUser, login, logout, getMe, refreshToken } from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { role } from '../middleware/role.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.post('/register', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), createUser);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.get('/me', auth, role([ROLES.USER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), getMe);

export default router;
