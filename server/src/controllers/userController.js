import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';

// GET /api/users
export const getUsers = async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const filter = {};

    // RBAC: Admin can only see users created by them
    if (req.user.role === ROLES.ADMIN) {
      filter.createdBy = req.user._id;
    } else if (req.user.role === ROLES.USER) {
      // User can only see themselves
      filter._id = req.user._id;
    }

    if (role && Object.values(ROLES).includes(role)) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.status(200).json({
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('createdBy', 'name email role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // RBAC check: admin can only view if createdBy matches
    if (req.user.role === ROLES.ADMIN && String(user.createdBy?._id || user.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden. You do not manage this user.' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// POST /api/users
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, isActive } = req.body;

    // RBAC: Admin cannot create super_admin or admin; admin can ONLY create 'user'
    if (req.user.role === ROLES.ADMIN && role !== ROLES.USER) {
      return res.status(403).json({ message: 'Admins can only create regular users' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await User.hashPassword(password);
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role || ROLES.USER,
      createdBy: req.user._id,
      isActive: isActive !== undefined ? isActive : true
    });

    const populated = await User.findById(newUser._id).populate('createdBy', 'name email role');
    return res.status(201).json({
      message: 'User created successfully',
      user: populated
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // RBAC check: admin can only edit users created by them
    if (req.user.role === ROLES.ADMIN) {
      if (String(targetUser.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden: You cannot modify users you did not create' });
      }
      if (req.body.role && req.body.role !== ROLES.USER) {
        return res.status(403).json({ message: 'Admins cannot elevate users to admin or super_admin' });
      }
    }

    const { name, email, password, role, isActive } = req.body;
    if (name) targetUser.name = name;
    if (email && email.toLowerCase() !== targetUser.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing && String(existing._id) !== id) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      targetUser.email = email.toLowerCase();
    }
    if (password) {
      targetUser.passwordHash = await User.hashPassword(password);
    }
    if (role && (req.user.role === ROLES.SUPER_ADMIN || (req.user.role === ROLES.ADMIN && role === ROLES.USER))) {
      targetUser.role = role;
    }
    if (isActive !== undefined) {
      targetUser.isActive = isActive;
    }

    await targetUser.save();
    const updated = await User.findById(id).populate('createdBy', 'name email role');

    return res.status(200).json({
      message: 'User updated successfully',
      user: updated
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(req.user._id) === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === ROLES.ADMIN) {
      if (String(targetUser.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden: You cannot delete users you did not create' });
      }
    }

    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
