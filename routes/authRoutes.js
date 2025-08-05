import express from 'express';
import { register, login } from '../controllers/authController.js';
import { validateRegister, validateLogin, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Register new user
router.post('/register', validateRegister, handleValidationErrors, register);

// Login user
router.post('/login', validateLogin, handleValidationErrors, login);

export default router;