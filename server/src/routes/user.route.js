import { Router } from 'express';
import { getAllUsers, getUserById, updateUser, deleteUser, } from '../controllers/user.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { role } from '../middleware/role.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/all', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), getAllUsers);
router.get('/:id', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getUserById);
router.put('/:id', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), updateUser);
router.delete('/:id', auth, role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), deleteUser);

export default router;
