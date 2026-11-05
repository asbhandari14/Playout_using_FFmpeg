import { Router } from 'express';
import {
    getUsers, getUserById, createUser, updateUser, deleteUser,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

// Super admins and Admins can list and create users
router.get('/', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), getUsers);
router.post('/', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), createUser);

router.get('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getUserById);
router.put('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), updateUser);
router.delete('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), deleteUser);

export default router;
