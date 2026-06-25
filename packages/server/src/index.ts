import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import { bigintMiddleware } from "./middleware/bigint.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import userAccessRoutes from "./modules/users/user-access.routes.js";
import configRoutes, {
  connectionStatus,
  checkConnection,
} from "./modules/configs/config.routes.js";
import cdrRoutes from "./modules/cdr/cdr.routes.js";
import ruleRoutes from "./modules/rules/rule.routes.js";
import audioRoutes from "./modules/audio/audio.routes.js";
import downloadRoutes from "./modules/download/download.routes.js";
import reportRoutes from "./modules/reports/report.routes.js";
import schedulerRoutes from "./modules/scheduler/scheduler.routes.js";
import agentRoutes from "./modules/agents/agent.routes.js";
import roleRoutes from "./modules/roles/role.routes.js";
import { SchedulerService } from "./modules/scheduler/scheduler.service.js";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3009", 10);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3008",
    credentials: true,
  }),
);
app.use(express.json());
app.use(bigintMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/configs/status/public", (_req, res) => {
  res.json(connectionStatus);
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userAccessRoutes);
app.use("/api/users", userRoutes);
app.use("/api/configs", configRoutes);
app.use("/api/cdrs", cdrRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/roles", roleRoutes);

const scheduler = SchedulerService.getInstance();
scheduler.start().catch((err) => logger.error(`Scheduler start error: ${err}`));

checkConnection();
setInterval(checkConnection, 60000);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
