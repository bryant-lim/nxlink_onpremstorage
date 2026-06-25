import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import authRoutes from "./auth.routes.js";
import { prisma } from "../../config/database.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

describe("Auth Integration Tests", () => {
  let adminToken: string;

  beforeAll(async () => {
    const existing = await prisma.user.findUnique({
      where: { username: "admin" },
    });
    if (!existing) {
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash("admin123", 12);
      await prisma.user.create({
        data: {
          username: "admin",
          passwordHash: hash,
          email: "admin@test.com",
          role: "admin",
        },
      });
    }
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should login with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user).toHaveProperty("username", "admin");
  });

  it("should reject login with invalid password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("should reject login with non-existent user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nonexistent", password: "password" });

    expect(res.status).toBe(401);
  });

  it("should get user profile with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("username", "admin");
    expect(res.body).toHaveProperty("role", "admin");
  });

  it("should reject access without token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("should reject access with invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalidtoken");

    expect(res.status).toBe(401);
  });

  it("should register new user with admin token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        username: "testuser",
        password: "testpass123",
        email: "test@test.com",
        role: "viewer",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("username", "testuser");
    expect(res.body).toHaveProperty("role", "viewer");

    await prisma.user.delete({ where: { username: "testuser" } });
  });

  it("should reject registration without admin token", async () => {
    const viewerRes = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        username: "testuser2",
        password: "testpass123",
        role: "viewer",
      });

    expect(viewerRes.status).toBe(201);
    await prisma.user.delete({ where: { username: "testuser2" } });
  });
});
