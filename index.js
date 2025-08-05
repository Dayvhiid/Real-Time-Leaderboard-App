import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import { handleValidationErrors } from './middleware/validation.js';


dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGO_URI)
       .then(() => {
        console.log("Database Connected Successfully");
        app.listen(process.env.PORT || 4000, () => {
            console.log(`Local Host running on PORT 4000`);
        });
       })
       .catch((err) => {
        console.log(err);
       });