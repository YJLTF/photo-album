import { Router } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { AccessKey } from "../entity/AccessKey";

const router = Router();

router.post("/login", async (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ message: "Access key is required" });
  }

  const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
    where: { key, active: true }
  });

  if (!accessKey) {
    return res.status(401).json({ message: "Invalid access key" });
  }

  const token = jwt.sign({ key: accessKey.key }, process.env.JWT_SECRET!, { expiresIn: "24h" });

  res.json({
    token,
    permission: accessKey.permission,
    description: accessKey.description
  });
});

router.post("/validate", async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false, message: "No token provided" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { key: string };
    const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
      where: { key: decoded.key, active: true }
    });

    if (!accessKey) {
      return res.status(401).json({ valid: false, message: "Invalid key" });
    }

    res.json({
      valid: true,
      permission: accessKey.permission,
      description: accessKey.description
    });
  } catch (error) {
    return res.status(401).json({ valid: false, message: "Invalid token" });
  }
});

export default router;